import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  MessageCircle, Users, LogOut, Send, ImagePlus, Plus, Phone, Video,
  Search, CheckCheck, X, PhoneOff, Settings as SettingsIcon, CirclePlus,
  UsersRound, Activity, UserRoundPlus, Sun, Moon
} from 'lucide-react';
import { supabase } from './supabase';
import './style.css';

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [authMethod, setAuthMethod] = useState('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+256');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [phoneStep, setPhoneStep] = useState(false);
  const [notice, setNotice] = useState('');

  const [people, setPeople] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('chats');
  const [showNew, setShowNew] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selected, setSelected] = useState([]);
  const [call, setCall] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [theme, setTheme] = useState(
    () => localStorage.getItem('uchat-theme') || 'light'
  );
  const [statuses, setStatuses] = useState([]);
  const [statusText, setStatusText] = useState('');

  const bottomRef = useRef(null);
  const pcRef = useRef(null);
  const localRef = useRef(null);
  const remoteRef = useRef(null);
  const channelRef = useRef(null);
  const seenRef = useRef(new Set());

  const tell = (message) => {
    setNotice(message);
    setTimeout(() => setNotice(''), 4500);
  };

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('uchat-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;

    let live = true;

    (async () => {
      let { data: currentProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      if (!currentProfile) {
        currentProfile = {
          id: session.user.id,
          display_name:
            session.user.user_metadata?.display_name ||
            session.user.email?.split('@')[0] ||
            'User'
        };

        await supabase.from('profiles').upsert(currentProfile);
      }

      if (live) {
        setProfile(currentProfile);
        setNewDisplayName(currentProfile.display_name || '');
        setNewUsername(currentProfile.username || '');
      }

      await loadPeople();
      await loadRooms();
      await loadStatuses();
    })();

    return () => {
      live = false;
    };
  }, [session]);

  async function loadPeople() {
    const { data, error } = await supabase
      .from('profiles')
      .select('id,display_name,username,avatar_url,updated_at')
      .order('display_name');

    if (error) tell(error.message);
    else setPeople(data || []);
  }

  async function loadStatuses() {
    const { data, error } = await supabase
      .from('statuses')
      .select('id,user_id,body,created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      if (!error.message.includes('statuses')) tell(error.message);
    } else {
      setStatuses(data || []);
    }
  }

  async function postStatus(event) {
    event.preventDefault();

    const body = statusText.trim();

    if (!body) return;
    if (body.length > 280) {
      return tell('Status must be 280 characters or fewer.');
    }

    const { error } = await supabase
      .from('statuses')
      .insert({ user_id: session.user.id, body });

    if (error) {
      tell('Could not post status: ' + error.message);
      return;
    }

    setStatusText('');
    await loadStatuses();
    tell('Status posted.');
  }

  async function pickContacts() {
    try {
      if (!('contacts' in navigator) || !navigator.contacts?.select) {
        tell(
          'Contact picker is not supported in this browser. Search by username or display name instead.'
        );
        return;
      }

      const picked = await navigator.contacts.select(
        ['name', 'email'],
        { multiple: true }
      );

      if (!picked.length) return;

      const names = picked
        .flatMap((contact) => contact.name || [])
        .map((name) => name.toLowerCase());

      const matches = people.filter(
        (person) =>
          person.id !== session.user.id &&
          names.includes((person.display_name || '').toLowerCase())
      );

      setTab('people');

      if (matches.length) {
        tell(
          `Found ${matches.length} matching UChat contact(s). Search results are available in People.`
        );
      } else {
        tell(
          'No matching UChat accounts found. Try searching by username.'
        );
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        tell('Could not access contacts. You can search by username instead.');
      }
    }
  }

  async function loadRooms() {
    const { data, error } = await supabase
      .from('room_members')
      .select('room_id,rooms(id,name,is_group,created_by,created_at)')
      .order('created_at', { ascending: false });

    if (error) {
      tell(error.message);
      return;
    }

    const base = (data || []).map((item) => item.rooms).filter(Boolean);
    const ids = [...new Set(base.map((room) => room.id))];

    if (!ids.length) {
      setRooms([]);
      return;
    }

    const { data: members } = await supabase
      .from('room_members')
      .select('room_id,user_id')
      .in('room_id', ids);

    const mapped = base.map((room) => {
      if (room.is_group) return room;

      const other = (members || []).find(
        (member) =>
          member.room_id === room.id &&
          member.user_id !== session?.user?.id
      );

      const person = people.find(
        (item) => item.id === other?.user_id
      );

      return {
        ...room,
        display_title: person?.display_name || 'Direct chat'
      };
    });

    setRooms(mapped);
  }

  useEffect(() => {
    if (!active || !session) return;

    let alive = true;
    seenRef.current = new Set();

    (async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('id,room_id,sender_id,body,image_url,created_at,read_by')
        .eq('room_id', active.id)
        .order('created_at');

      if (error) tell(error.message);

      if (alive) {
        setMessages(data || []);
        markRead(data || []);
      }
    })();

    const channel = supabase
      .channel('room-' + active.id)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: 'room_id=eq.' + active.id
        },
        (payload) => {
          setMessages((oldMessages) =>
            oldMessages.some((message) => message.id === payload.new.id)
              ? oldMessages
              : [...oldMessages, payload.new]
          );

          if (payload.new.sender_id !== session.user.id) {
            markRead([payload.new]);
          }
        }
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [active?.id, session?.user?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function markRead(rows) {
    for (const message of rows) {
      if (
        message.sender_id === session?.user?.id ||
        seenRef.current.has(message.id)
      ) {
        continue;
      }

      seenRef.current.add(message.id);

      const readers = Array.isArray(message.read_by)
        ? message.read_by
        : [];

      if (!readers.includes(session.user.id)) {
        await supabase
          .from('messages')
          .update({ read_by: [...readers, session.user.id] })
          .eq('id', message.id);
      }
    }
  }

  async function authSubmit(event) {
    event.preventDefault();
    setNotice('');

    if (!supabase) return;

    let result;

    if (authMode === 'signup') {
      result = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin + '/'
        }
      });
    } else {
      result = await supabase.auth.signInWithPassword({
        email,
        password
      });
    }

    if (result.error) {
      tell(result.error.message);
    } else if (authMode === 'signup' && !result.data.session) {
      tell('Check your email to confirm your account, then log in.');
    } else {
      tell(authMode === 'signup' ? 'Account created.' : 'Welcome back.');
    }
  }

  async function authProvider(provider) {
    setNotice('');

    if (!supabase) return;

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin + '/'
      }
    });

    if (error) tell(error.message);
  }

  async function sendPhoneCode(event) {
    event?.preventDefault();

    if (!supabase) return;

    const national = phone
      .trim()
      .replace(/[\s()-]/g, '')
      .replace(/^0/, '');

    if (!/^\d{6,14}$/.test(national)) {
      return tell(
        'Enter a valid phone number without the country code.'
      );
    }

    const fullPhone = countryCode + national;

    const { error } = await supabase.auth.signInWithOtp({
      phone: fullPhone,
      options: {
        shouldCreateUser: authMode === 'signup'
      }
    });

    if (error) {
      tell(error.message);
      return;
    }

    setPhone(fullPhone);
    setPhoneStep(true);
    tell('Verification code sent to ' + fullPhone + '.');
  }

  async function verifyPhoneCode(event) {
    event?.preventDefault();

    if (!supabase) return;

    if (!/^\d{4,8}$/.test(phoneOtp.trim())) {
      return tell('Enter the SMS verification code.');
    }

    const { error } = await supabase.auth.verifyOtp({
      phone,
      token: phoneOtp.trim(),
      type: 'sms'
    });

    if (error) {
      tell(error.message);
      return;
    }

    setPhoneStep(false);
    setPhoneOtp('');
    tell('Phone number verified. Welcome to UChat.');
  }

  async function saveDisplayName(event) {
    event.preventDefault();

    const value = newDisplayName.trim();
    const handle = newUsername.trim().toLowerCase().replace(/^@/, '');

    if (!value) return tell('Enter a display name.');

    if (value.length > 40) {
      return tell('Display name must be 40 characters or fewer.');
    }

    if (!/^[a-z0-9_]{3,24}$/.test(handle)) {
      return tell(
        'Username must be 3–24 characters: letters, numbers, underscores.'
      );
    }

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: session.user.id,
        display_name: value,
        username: handle,
        updated_at: new Date().toISOString()
      });

    if (error) {
      tell('Could not save display name: ' + error.message);
      return;
    }

    setProfile((oldProfile) => ({
      ...oldProfile,
      display_name: value,
      username: handle
    }));

    await loadPeople();
    setShowSettings(false);
    tell('Display name updated.');
  }

  async function signOut() {
    await endCall();
    await supabase.auth.signOut();
    setProfile(null);
    setActive(null);
    setRooms([]);
    setMessages([]);
  }

  async function openDirect(person) {
    if (person.id === session.user.id) {
      tell('That is your own account.');
      return;
    }

    const { data, error } = await supabase.rpc(
      'get_or_create_direct_room',
      { other_user: person.id }
    );

    if (error) {
      tell('Could not open chat: ' + error.message);
      return;
    }

    await loadRooms();

    const { data: room } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', data)
      .single();

    if (!room) {
      tell('Could not load the conversation.');
      return;
    }

    setActive({
      ...room,
      display_title: person.display_name || 'Direct chat'
    });

    setTab('chats');
    setShowNew(false);
  }

  async function createGroup(event) {
    event.preventDefault();

    if (!groupName.trim() || !selected.length) return;

    const { data, error } = await supabase
      .from('rooms')
      .insert({
        name: groupName.trim(),
        is_group: true,
        created_by: session.user.id
      })
      .select()
      .single();

    if (error) {
      tell(error.message);
      return;
    }

    const members = [session.user.id, ...selected];

    const { error: memberError } = await supabase
      .from('room_members')
      .insert(
        members.map((user_id) => ({
          room_id: data.id,
          user_id
        }))
      );

    if (memberError) {
      tell(memberError.message);
      return;
    }

    await loadRooms();
    setActive(data);
    setShowNew(false);
    setGroupName('');
    setSelected([]);
    tell('Group created.');
  }

  async function sendMessage(event) {
    event?.preventDefault();

    if (!active || !draft.trim()) return;

    const body = draft.trim();
    setDraft('');

    const { error } = await supabase
      .from('messages')
      .insert({
        room_id: active.id,
        sender_id: session.user.id,
        body,
        read_by: [session.user.id]
      });

    if (error) {
      setDraft(body);
      tell(error.message);
    }
  }

  async function uploadImage(event) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !active) return;

    if (!file.type.startsWith('image/')) {
      return tell('Choose an image file.');
    }

    if (file.size > 5 * 1024 * 1024) {
      return tell('Image must be 5 MB or smaller.');
    }

    const path =
      `${session.user.id}/${crypto.randomUUID()}-` +
      file.name.replace(/[^a-zA-Z0-9._-]/g, '_');

    const { error: uploadError } = await supabase.storage
      .from('chat-images')
      .upload(path, file, { upsert: false });

    if (uploadError) {
      return tell('Image upload failed: ' + uploadError.message);
    }

    const { data } = supabase.storage
      .from('chat-images')
      .getPublicUrl(path);

    const { error } = await supabase
      .from('messages')
      .insert({
        room_id: active.id,
        sender_id: session.user.id,
        image_url: data.publicUrl,
        body: '',
        read_by: [session.user.id]
      });

    if (error) tell(error.message);
  }

  async function startCall(kind) {
    if (!active || active.is_group) {
      return tell(
        'Calls are available in one-to-one chats only in this starter.'
      );
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: kind === 'video'
      });

      if (localRef.current) localRef.current.srcObject = stream;
      setCall({ kind, status: 'Calling…' });

      const connection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      });

      pcRef.current = connection;
      stream.getTracks().forEach((track) => {
        connection.addTrack(track, stream);
      });

      connection.ontrack = (event) => {
        if (remoteRef.current) {
          remoteRef.current.srcObject = event.streams[0];
        }
      };

      const channel = supabase.channel('call-room-' + active.id, {
        config: {
          private: true,
          broadcast: { self: false }
        }
      });

      channelRef.current = channel;

      channel.on('broadcast', { event: 'signal' }, async ({ payload }) => {
        if (payload.from === session.user.id) return;

        try {
          if (payload.type === 'offer') {
            await connection.setRemoteDescription(payload.sdp);

            const answer = await connection.createAnswer();
            await connection.setLocalDescription(answer);

            await channel.send({
              type: 'broadcast',
              event: 'signal',
              payload: {
                type: 'answer',
                sdp: connection.localDescription,
                from: session.user.id
              }
            });
          } else if (
            payload.type === 'answer' &&
            connection.signalingState === 'have-local-offer'
          ) {
            await connection.setRemoteDescription(payload.sdp);
          } else if (payload.type === 'ice' && payload.candidate) {
            await connection.addIceCandidate(payload.candidate);
          } else if (payload.type === 'hangup') {
            await endCall(false);
          }
        } catch (error) {
          tell('Call connection error: ' + error.message);
        }
      });

      connection.onicecandidate = (event) => {
        if (event.candidate) {
          channel.send({
            type: 'broadcast',
            event: 'signal',
            payload: {
              type: 'ice',
              candidate: event.candidate,
              from: session.user.id
            }
          });
        }
      };

      connection.onconnectionstatechange = () => {
        if (connection.connectionState === 'connected') {
          setCall((current) =>
            current ? { ...current, status: 'Connected' } : current
          );
        }

        if (
          ['failed', 'disconnected'].includes(connection.connectionState)
        ) {
          setCall((current) =>
            current ? { ...current, status: 'Connection issue' } : current
          );
        }
      };

      channel.subscribe(async (status) => {
        if (status !== 'SUBSCRIBED') return;

        try {
          const offer = await connection.createOffer();
          await connection.setLocalDescription(offer);

          await channel.send({
            type: 'broadcast',
            event: 'signal',
            payload: {
              type: 'offer',
              sdp: connection.localDescription,
              from: session.user.id
            }
          });
        } catch (error) {
          tell('Could not create call offer: ' + error.message);
        }
      });
    } catch (error) {
      tell(
        'Could not start call. Check microphone/camera permissions. ' +
        error.message
      );
      await endCall();
    }
  }

  async function endCall(sendSignal = true) {
    if (sendSignal && channelRef.current) {
      await channelRef.current
        .send({
          type: 'broadcast',
          event: 'signal',
          payload: {
            type: 'hangup',
            from: session?.user?.id
          }
        })
        .catch(() => {});
    }

    if (channelRef.current) {
      supabase?.removeChannel(channelRef.current);
    }

    channelRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;

    localRef.current?.srcObject?.getTracks().forEach((track) => track.stop());
    remoteRef.current?.srcObject?.getTracks().forEach((track) => track.stop());

    if (localRef.current) localRef.current.srcObject = null;
    if (remoteRef.current) remoteRef.current.srcObject = null;

    setCall(null);
  }

  if (!supabase) {
    return (
      <div className="setup">
        <h1>UChat</h1>
        <p>One setup step before UChat can run.</p>
        <p>
          Create a Supabase project, then copy <code>.env.example</code>
          {' '}to <code>.env</code> and enter your project URL and publishable key.
        </p>
      </div>
    );
  }

  if (!session) {
    return (
      <main className="auth">
        <div className="brand">
          <span className="logo">
            <img src="./uchat-logo.svg" alt="" />
          </span>
          <h1>UChat</h1>
          <p>Simple conversations. Wherever you are.</p>
        </div>

        <form
          className="authform"
          onSubmit={
            authMethod === 'phone'
              ? (phoneStep ? verifyPhoneCode : sendPhoneCode)
              : authSubmit
          }
        >
          <h2>
            {phoneStep
              ? 'Verify your phone'
              : authMode === 'login'
                ? 'Welcome back'
                : 'Create your account'}
          </h2>

          <div className="auth-methods">
            <button
              type="button"
              className={authMethod === 'email' ? 'chosen' : ''}
              onClick={() => {
                setAuthMethod('email');
                setPhoneStep(false);
              }}
            >
              Email
            </button>
            <button
              type="button"
              className={authMethod === 'phone' ? 'chosen' : ''}
              onClick={() => {
                setAuthMethod('phone');
                setPhoneStep(false);
              }}
            >
              Phone number
            </button>
          </div>

          {authMethod === 'email' ? (
            <>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email address"
                required
              />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password (at least 8 characters)"
                minLength={8}
                required
              />
              <button className="primary">
                {authMode === 'login' ? 'Log in' : 'Create account'}
              </button>
            </>
          ) : phoneStep ? (
            <>
              <p className="phone-help">
                Enter the SMS code sent to <strong>{phone}</strong>.
              </p>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                value={phoneOtp}
                onChange={(event) => setPhoneOtp(event.target.value)}
                placeholder="SMS verification code"
                required
              />
              <button className="primary">Verify phone number</button>
              <button
                type="button"
                className="link phone-resend"
                onClick={sendPhoneCode}
              >
                Send code again
              </button>
            </>
          ) : (
            <>
              <div className="phone-entry">
                <select
                  aria-label="Country calling code"
                  value={countryCode}
                  onChange={(event) => setCountryCode(event.target.value)}
                >
                  <option value="+256">🇺🇬 Uganda (+256)</option>
                  <option value="+254">🇰🇪 Kenya (+254)</option>
                  <option value="+255">🇹🇿 Tanzania (+255)</option>
                  <option value="+250">🇷🇼 Rwanda (+250)</option>
                  <option value="+211">🇸🇸 South Sudan (+211)</option>
                  <option value="+234">🇳🇬 Nigeria (+234)</option>
                  <option value="+233">🇬🇭 Ghana (+233)</option>
                  <option value="+251">🇪🇹 Ethiopia (+251)</option>
                  <option value="+20">🇪🇬 Egypt (+20)</option>
                  <option value="+212">🇲🇦 Morocco (+212)</option>
                  <option value="+27">🇿🇦 South Africa (+27)</option>
                  <option value="+1">🇺🇸 USA/Canada (+1)</option>
                  <option value="+44">🇬🇧 United Kingdom (+44)</option>
                  <option value="+353">🇮🇪 Ireland (+353)</option>
                  <option value="+33">🇫🇷 France (+33)</option>
                  <option value="+49">🇩🇪 Germany (+49)</option>
                  <option value="+39">🇮🇹 Italy (+39)</option>
                  <option value="+34">🇪🇸 Spain (+34)</option>
                  <option value="+351">🇵🇹 Portugal (+351)</option>
                  <option value="+91">🇮🇳 India (+91)</option>
                  <option value="+86">🇨🇳 China (+86)</option>
                  <option value="+81">🇯🇵 Japan (+81)</option>
                  <option value="+82">🇰🇷 South Korea (+82)</option>
                  <option value="+61">🇦🇺 Australia (+61)</option>
                  <option value="+64">🇳🇿 New Zealand (+64)</option>
                  <option value="+971">🇦🇪 UAE (+971)</option>
                  <option value="+966">🇸🇦 Saudi Arabia (+966)</option>
                  <option value="+974">🇶🇦 Qatar (+974)</option>
                  <option value="+90">🇹🇷 Türkiye (+90)</option>
                  <option value="+7">🇰🇿 Kazakhstan/Russia (+7)</option>
                  <option value="+55">🇧🇷 Brazil (+55)</option>
                  <option value="+52">🇲🇽 Mexico (+52)</option>
                </select>

                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="Phone number"
                  required
                />
              </div>

              <p className="phone-help">
                We’ll text you a verification code. Enter your number without
                the country code.
              </p>
              <button className="primary">Send verification code</button>
            </>
          )}

          {!phoneStep && (
            <>
              <div className="authdivider">
                <span>or continue with</span>
              </div>

              <button
                type="button"
                className="oauthbtn"
                onClick={() => authProvider('google')}
              >
                <span className="googlemark">G</span>
                {' '}Continue with Google
              </button>

              <button
                type="button"
                className="oauthbtn"
                onClick={() => authProvider('apple')}
              >
                <span className="applemark">●</span>
                {' '}Continue with Apple
              </button>
            </>
          )}

          <p>
            {authMode === 'login'
              ? 'New to UChat?'
              : 'Already registered?'}{' '}
            <button
              type="button"
              className="link"
              onClick={() => {
                setAuthMode(authMode === 'login' ? 'signup' : 'login');
                setPhoneStep(false);
                setPhoneOtp('');
              }}
            >
              {authMode === 'login' ? 'Create an account' : 'Log in'}
            </button>
          </p>
        </form>

        {notice && <div className="toast">{notice}</div>}
      </main>
    );
  }

  const myId = session.user.id;

  const shownPeople = people.filter(
    (person) =>
      person.id !== myId &&
      (
        (person.display_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (person.username || '')
          .toLowerCase()
          .includes(search.toLowerCase().replace(/^@/, ''))
      )
  );

  const shownRooms = rooms.filter(
    (room) =>
      (room.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (room.display_title || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="app">
      <header className="topbar">
        <div className="brandmini">
          <span className="logo">
            <img src="./uchat-logo.svg" alt="" />
          </span>
          <strong>UChat</strong>
        </div>

        <div className="topright">
          <span className="userlabel">
            {profile?.display_name || session.user.email || session.user.phone}
          </span>

          <button
            className="iconbtn"
            title="Settings"
            onClick={() => {
              setNewDisplayName(profile?.display_name || '');
              setNewUsername(profile?.username || '');
              setShowSettings(true);
            }}
          >
            <SettingsIcon size={18} />
          </button>

          <button
            className="iconbtn"
            title="Sign out"
            onClick={signOut}
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <div className="workspace">
        <aside className={`sidebar ${active ? 'hide-mobile' : ''}`}>
          {tab === 'chats' && (
            <div className="wa-chat-title">
              <h1>Chats</h1>
              <button
                className="wa-newchat"
                onClick={() => {
                  setTab('people');
                  setSearch('');
                }}
                aria-label="New chat"
              >
                <Plus size={25} />
              </button>
            </div>
          )}

          <div className="searchbox">
            <Search size={19} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={
                tab === 'chats'
                  ? 'Ask UChat or Search'
                  : tab === 'groups'
                    ? 'Search groups'
                    : tab === 'status'
                      ? 'Search updates'
                      : 'Search username or name'
              }
            />
          </div>

          {/* Correctly closed conditional: this was the filter JSX issue. */}
          {tab === 'chats' && (
            <div className="wa-filters">
              <button className="selected">All</button>
              <button
                onClick={() => tell('Unread filtering is not implemented yet.')}
              >
                Unread
              </button>
              <button
                onClick={() => tell('Favorites are not implemented yet.')}
              >
                Favorites
              </button>
              <button onClick={() => setTab('groups')}>Groups</button>
              <button
                className="filter-add"
                onClick={() => {
                  setTab('people');
                  setSearch('');
                }}
                aria-label="Find a person"
              >
                <Plus size={20} />
              </button>
            </div>
          )}

          {tab === 'chats' ? (
            <>
              <div className="listheading">
                YOUR CONVERSATIONS
                <button
                  className="iconbtn"
                  onClick={() => setShowNew(true)}
                  title="Create group"
                >
                  <Plus size={18} />
                </button>
              </div>

              <div className="roomlist">
                {shownRooms.map((room) => (
                  <button
                    key={room.id}
                    className={`roomrow ${active?.id === room.id ? 'chosen' : ''}`}
                    onClick={() => setActive(room)}
                  >
                    <span className="avatar">
                      {room.is_group
                        ? <Users size={18} />
                        : (room.display_title || room.name || 'C')[0].toUpperCase()}
                    </span>
                    <span className="roomtext">
                      <strong>
                        {room.is_group
                          ? (room.name || 'Group')
                          : (room.display_title || room.name || 'Direct chat')}
                      </strong>
                      <small>
                        {room.is_group ? 'Group chat' : 'Private chat'}
                      </small>
                    </span>
                  </button>
                ))}

                {!shownRooms.length && (
                  <p className="empty">
                    No chats yet. Open People to start one.
                  </p>
                )}
              </div>
            </>
          ) : tab === 'groups' ? (
            <>
              <div className="listheading">
                YOUR GROUPS
                <button
                  className="iconbtn"
                  onClick={() => setShowNew(true)}
                  title="Create group"
                >
                  <Plus size={18} />
                </button>
              </div>

              <div className="roomlist">
                {shownRooms
                  .filter((room) => room.is_group)
                  .map((room) => (
                    <button
                      key={room.id}
                      className={`roomrow ${active?.id === room.id ? 'chosen' : ''}`}
                      onClick={() => setActive(room)}
                    >
                      <span className="avatar">
                        <UsersRound size={18} />
                      </span>
                      <span className="roomtext">
                        <strong>{room.name || 'Group'}</strong>
                        <small>Group conversation</small>
                      </span>
                    </button>
                  ))}

                {!shownRooms.some((room) => room.is_group) && (
                  <p className="empty">
                    No groups yet. Use + to create one.
                  </p>
                )}
              </div>
            </>
          ) : tab === 'status' ? (
            <>
              <div className="listheading">RECENT STATUS</div>

              <form className="statusform" onSubmit={postStatus}>
                <textarea
                  value={statusText}
                  onChange={(event) => setStatusText(event.target.value)}
                  placeholder="Share a status update..."
                  maxLength={280}
                />
                <button className="primary" disabled={!statusText.trim()}>
                  Post status
                </button>
              </form>

              <div className="roomlist">
                {statuses.map((status) => (
                  <div className="statusrow" key={status.id}>
                    <span className="avatar">
                      <Activity size={16} />
                    </span>
                    <div>
                      <strong>
                        {people.find((person) => person.id === status.user_id)
                          ?.display_name || 'UChat user'}
                      </strong>
                      <p>{status.body}</p>
                      <small>
                        {new Date(status.created_at).toLocaleString()}
                      </small>
                    </div>
                  </div>
                ))}

                {!statuses.length && (
                  <p className="empty">No status updates yet.</p>
                )}
              </div>
            </>
          ) : tab === 'calls' ? (
            <>
              <div className="listheading">CALLS</div>
              <div className="call-list-placeholder">
                <Phone size={30} />
                <strong>Your calls</strong>
                <p>
                  Voice and video calls with UChat contacts will appear here.
                </p>
                <button
                  className="primary"
                  onClick={() => setTab('people')}
                >
                  Start a call
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="listheading">
                FIND PEOPLE
                <button
                  className="iconbtn"
                  onClick={pickContacts}
                  title="Choose from device contacts"
                >
                  <UserRoundPlus size={18} />
                </button>
              </div>

              <button className="contactpick" onClick={pickContacts}>
                <UserRoundPlus size={16} />
                {' '}Choose from device contacts
              </button>

              <div className="roomlist">
                {shownPeople.map((person) => (
                  <button
                    key={person.id}
                    className="roomrow"
                    onClick={() => openDirect(person)}
                  >
                    <span className="avatar">
                      {(person.display_name || 'U')[0].toUpperCase()}
                    </span>
                    <span className="roomtext">
                      <strong>{person.display_name || 'UChat user'}</strong>
                      <small>
                        @{person.username || 'username-not-set'} · Start a conversation
                      </small>
                    </span>
                    <CirclePlus size={17} />
                  </button>
                ))}

                {!shownPeople.length && (
                  <p className="empty">
                    No matching users. Search their username or display name.
                  </p>
                )}
              </div>
            </>
          )}

          <div className="sidebarfoot">UChat · Stay connected</div>
        </aside>

        <section
          className={`chatpane ${!active ? 'no-active' : ''} ${active ? 'show-mobile' : ''}`}
        >
          {active ? (
            <>
              <div className="chathead">
                <button
                  className="backmobile"
                  onClick={() => setActive(null)}
                >
                  ‹
                </button>

                <span className="avatar">
                  {active.is_group
                    ? <Users size={18} />
                    : (active.display_title || active.name || 'C')[0].toUpperCase()}
                </span>

                <div className="chatheadtext">
                  <strong>
                    {active.is_group
                      ? (active.name || 'Group')
                      : (active.display_title || 'Direct chat')}
                  </strong>
                  <small>
                    {active.is_group ? 'Group conversation' : 'Messages are live'}
                  </small>
                </div>

                <div className="callbuttons">
                  <button
                    title="Voice call"
                    onClick={() => startCall('audio')}
                  >
                    <Phone size={18} />
                  </button>
                  <button
                    title="Video call"
                    onClick={() => startCall('video')}
                  >
                    <Video size={19} />
                  </button>
                </div>
              </div>

              <div className="messages">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`bubblewrap ${message.sender_id === myId ? 'mine' : 'theirs'}`}
                  >
                    <div className="bubble">
                      {message.sender_id !== myId && active.is_group && (
                        <small className="sender">
                          {people.find((person) => person.id === message.sender_id)
                            ?.display_name || 'Member'}
                        </small>
                      )}

                      {message.image_url && (
                        <a
                          href={message.image_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <img
                            className="chatimage"
                            src={message.image_url}
                            alt="Shared image"
                          />
                        </a>
                      )}

                      {message.body && <div>{message.body}</div>}

                      <div className="meta">
                        {new Date(message.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                        {message.sender_id === myId && (
                          <CheckCheck
                            size={14}
                            className={(message.read_by || []).length > 1 ? 'read' : ''}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                <div ref={bottomRef} />

                {!messages.length && (
                  <div className="emptychat">
                    Say hello 👋
                    <small>Your messages will appear here.</small>
                  </div>
                )}
              </div>

              <form className="composer" onSubmit={sendMessage}>
                <label className="attach" title="Share image">
                  <ImagePlus size={21} />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={uploadImage}
                  />
                </label>

                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Type a message"
                  maxLength={4000}
                />

                <button
                  className="sendbtn"
                  disabled={!draft.trim()}
                  aria-label="Send"
                >
                  <Send size={19} />
                </button>
              </form>
            </>
          ) : (
            <div className="welcome">
              <div className="welcomeicon">
                <MessageCircle size={54} />
              </div>
              <h2>UChat Web</h2>
              <p>Send messages, share moments, and stay connected.</p>
              <small>
                Select a conversation or find people to start chatting.
              </small>
              <div className="encrypted">
                Private conversations · Real-time updates
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="floating-nav-wrap">
        <nav className="floating-nav wa-dock" aria-label="Main navigation">
          <button
            className={tab === 'status' ? 'active' : ''}
            onClick={() => setTab('status')}
            aria-label="Updates"
          >
            <Activity />
            <span>Updates</span>
          </button>

          <button
            className={tab === 'calls' ? 'active' : ''}
            onClick={() => setTab('calls')}
            aria-label="Calls"
          >
            <Phone />
            <span>Calls</span>
          </button>

          <button
            className={tab === 'groups' ? 'active' : ''}
            onClick={() => setTab('groups')}
            aria-label="Communities"
          >
            <UsersRound />
            <span>Communities</span>
          </button>

          <button
            className={tab === 'chats' ? 'active' : ''}
            onClick={() => setTab('chats')}
            aria-label="Chats"
          >
            <MessageCircle />
            <span>Chats</span>
          </button>

          <button
            className="nav-settings"
            onClick={() => {
              setNewDisplayName(profile?.display_name || '');
              setNewUsername(profile?.username || '');
              setShowSettings(true);
            }}
            aria-label="You"
          >
            <span className="you-avatar">
              {(profile?.display_name || 'U').slice(0, 1).toUpperCase()}
            </span>
            <span>You</span>
          </button>
        </nav>
      </div>

      {showSettings && (
        <div
          className="modalback"
          onClick={() => setShowSettings(false)}
        >
          <form
            className="modal"
            onSubmit={saveDisplayName}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modalhead">
              <h2>Settings</h2>
              <button
                type="button"
                className="iconbtn"
                onClick={() => setShowSettings(false)}
              >
                <X />
              </button>
            </div>

            <label className="settinglabel">Display name</label>
            <input
              value={newDisplayName}
              onChange={(event) => setNewDisplayName(event.target.value)}
              placeholder="Your display name"
              maxLength={40}
              required
            />
            <p className="hint">
              You can change how your name appears to other UChat users at any time.
            </p>

            <label className="settinglabel">Username</label>
            <input
              value={newUsername}
              onChange={(event) => setNewUsername(event.target.value)}
              placeholder="username"
              maxLength={24}
              required
            />
            <p className="hint">
              Unique username, 3–24 characters. Letters, numbers and underscores only.
            </p>

            <label className="settinglabel">Appearance</label>
            <button
              type="button"
              className="themebutton"
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            >
              {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
              {' '}Switch to {theme === 'light' ? 'dark' : 'light'} mode
            </button>

            <button className="primary">Save changes</button>
          </form>
        </div>
      )}

      {showNew && (
        <div className="modalback" onClick={() => setShowNew(false)}>
          <form
            className="modal"
            onSubmit={createGroup}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modalhead">
              <h2>Create a group</h2>
              <button
                type="button"
                className="iconbtn"
                onClick={() => setShowNew(false)}
              >
                <X />
              </button>
            </div>

            <input
              placeholder="Group name"
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              maxLength={60}
              required
            />

            <p className="hint">Choose members</p>

            <div className="memberchoices">
              {people
                .filter((person) => person.id !== myId)
                .map((person) => (
                  <label key={person.id}>
                    <input
                      type="checkbox"
                      checked={selected.includes(person.id)}
                      onChange={(event) =>
                        setSelected((old) =>
                          event.target.checked
                            ? [...old, person.id]
                            : old.filter((id) => id !== person.id)
                        )
                      }
                    />
                    {person.display_name || 'UChat user'}
                  </label>
                ))}
            </div>

            <button className="primary" disabled={!selected.length}>
              Create group
            </button>
          </form>
        </div>
      )}

      {call && (
        <div className="callback">
          <div className="callwindow">
            <button
              className="callclose"
              onClick={() => endCall()}
            >
              <X />
            </button>

            <h2>{call.kind === 'video' ? 'Video call' : 'Voice call'}</h2>
            <p>{call.status}</p>

            <video
              ref={remoteRef}
              autoPlay
              playsInline
              className="remotevideo"
            />
            <video
              ref={localRef}
              autoPlay
              muted
              playsInline
              className="localvideo"
            />

            <div className="callcontrols">
              <button className="hangup" onClick={() => endCall()}>
                <PhoneOff />
              </button>
            </div>

            <small>
              Allow microphone/camera access. Calls may fail behind restrictive
              NATs; a TURN server is needed for reliable production calls.
            </small>
          </div>
        </div>
      )}

      {notice && <div className="toast">{notice}</div>}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
