import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Search, ShoppingBag, ArrowRight, Laptop, Smartphone, Headphones, Cable, ShieldCheck, X, Plus, Minus, RefreshCw } from 'lucide-react';
import './style.css';

const API = (import.meta.env.VITE_STORE_API_URL || '').replace(/\/$/, '');
const money = (n) => new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(Number(n || 0));

function App() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [software, setSoftware] = useState(false);
  const [cart, setCart] = useState(() => { try { return JSON.parse(localStorage.getItem('tech-store-cart') || '[]'); } catch { return []; } });
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [customer, setCustomer] = useState({ name: '', phone: '+256', district: '', town: '', address: '' });

  async function loadCatalog() {
    setLoading(true); setError('');
    try {
      if (!API) throw new Error('The secure Store API has not been connected yet.');
      const response = await fetch(API + '/catalog');
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not load products.');
      setProducts(data.products || []); setCategories(data.categories || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { loadCatalog(); }, []);
  useEffect(() => { localStorage.setItem('tech-store-cart', JSON.stringify(cart)); }, [cart]);

  const visible = useMemo(() => products.filter((p) => {
    const q = search.toLowerCase().trim();
    return p.is_active !== false && (category === 'all' || p.category_slug === category) &&
      (!software || p.product_type === 'software') &&
      (!q || [p.name, p.brand, p.description, p.sku].filter(Boolean).join(' ').toLowerCase().includes(q));
  }), [products, search, category, software]);

  const count = cart.reduce((n, p) => n + p.quantity, 0);
  const total = cart.reduce((n, p) => n + Number(p.price_ugx) * p.quantity, 0);

  function add(product) {
    setCart((old) => {
      const found = old.find((p) => p.id === product.id);
      return found ? old.map((p) => p.id === product.id ? { ...p, quantity: p.quantity + 1 } : p) :
        [...old, { id: product.id, name: product.name, price_ugx: product.price_ugx, product_type: product.product_type, image_url: product.image_url, quantity: 1 }];
    });
    setNotice('Added to cart.');
  }
  function quantity(id, delta) {
    setCart((old) => old.map((p) => p.id === id ? { ...p, quantity: p.quantity + delta } : p).filter((p) => p.quantity > 0));
  }
  async function placeOrder(e) {
    e.preventDefault();
    if (!API) { setNotice('Checkout is not available until the secure Store API is connected.'); return; }
    setBusy(true);
    try {
      const response = await fetch(API + '/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'website',
          customer: { full_name: customer.name, phone_e164: customer.phone },
          items: cart.map((p) => ({ product_id: p.id, quantity: p.quantity })),
          delivery: { district: customer.district, town: customer.town, address_line: customer.address }
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Order request failed.');
      setCart([]); setCheckoutOpen(false); setCartOpen(false);
      setNotice(data.message || ('Order ' + (data.order_number || '') + ' received.'));
    } catch (e) { setNotice(e.message); }
    finally { setBusy(false); }
  }

  return <div className="app-shell">
    <header className="header">
      <a className="brand" href="/"><span className="brand-mark">T</span><span>TECH<span>STORE</span><small>UGANDA</small></span></a>
      <nav><a href="#shop">Shop</a><a href="#software">Windows software</a><a href="#about">Why Tech Store</a></nav>
      <button className="cart-button" onClick={() => setCartOpen(true)}><ShoppingBag size={18}/> Cart <b>{count}</b></button>
    </header>

    <main>
      <section className="hero">
        <div className="hero-copy"><span className="eyebrow">YOUR EVERYDAY TECH STORE</span>
          <h1>Good tech.<br/><em>Better choices.</em></h1>
          <p>Shop electronics, phone accessories and legitimate Windows software in Uganda. Clear prices, helpful support and convenient ordering.</p>
          <a className="primary-button" href="#shop">Explore the store <ArrowRight size={17}/></a>
          <div className="proof"><span><ShieldCheck size={16}/> Genuine products</span><span>Uganda-focused support</span></div>
        </div>
        <div className="hero-visual"><div className="halo"></div><div className="phone-art"><div>TECH</div><strong>Stay<br/>connected.</strong></div><div className="earbuds-art"><i/><i/></div><div className="watch-art">09:41</div></div>
      </section>

      <section className="trust" id="about"><div><ShieldCheck/><b>Genuine products</b><small>Authenticity matters</small></div><div><ShoppingBag/><b>Convenient ordering</b><small>WhatsApp and website</small></div><div><Headphones/><b>Helpful support</b><small>Before and after purchase</small></div></section>

      <section className="shop" id="shop">
        <div className="section-head"><div><span className="eyebrow">THE TECH STORE COLLECTION</span><h2>Find your next upgrade.</h2><p>Browse the catalogue and compare your options.</p></div><button className="refresh" onClick={loadCatalog}><RefreshCw size={15}/> Refresh</button></div>
        <div className="tools"><label className="search"><Search size={18}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search phones, accessories, software..."/></label><button className={software ? 'selected' : ''} onClick={() => { setSoftware(!software); setCategory('all'); }}><Laptop size={16}/> Windows software</button></div>
        <div className="categories"><button className={category === 'all' ? 'active' : ''} onClick={() => setCategory('all')}>All products</button>{categories.map((c) => <button key={c.id} className={category === c.slug ? 'active' : ''} onClick={() => { setCategory(c.slug); setSoftware(false); }}>{c.name}</button>)}</div>
        {error && <div className="notice"><div><b>Store catalogue connection pending</b><p>{error}</p></div><button onClick={loadCatalog}>Retry</button></div>}
        {loading ? <div className="empty"><div className="spinner"/><p>Loading catalogue...</p></div> :
          visible.length ? <div className="products">{visible.map((p) => <article className="product" key={p.id}>
            <div className="product-image">{p.image_url ? <img src={p.image_url} alt={p.name}/> : <div className="placeholder"><Laptop size={38}/></div>}{p.product_type === 'software' && <label>Digital licence</label>}</div>
            <div className="product-copy"><small>{p.brand || (p.product_type === 'software' ? 'Windows software' : 'Tech Store')}</small><h3>{p.name}</h3><p>{p.description || 'Product details coming soon.'}</p><div className="product-foot"><strong>{money(p.price_ugx)}</strong><button onClick={() => add(p)} aria-label={'Add ' + p.name + ' to cart'}><Plus size={18}/></button></div>{p.product_type === 'software' && <small className="compat">Windows compatibility: {p.software_platform || 'confirm before purchase'}</small>}</div>
          </article>)}</div> : <div className="empty"><ShoppingBag size={28}/><h3>No products published yet</h3><p>Products will appear here when the Tech Store catalogue is connected and published.</p></div>}
      </section>

      <section className="software" id="software"><div className="software-icon"><Laptop size={28}/></div><div><span className="eyebrow">DIGITAL PRODUCTS</span><h2>Windows software, made simple.</h2><p>Legitimate licences for Windows 10 and Windows 11, with compatibility and licence terms shown before purchase.</p></div><button onClick={() => { setSoftware(true); setCategory('all'); document.getElementById('shop').scrollIntoView({ behavior: 'smooth' }); }}>Browse software <ArrowRight size={16}/></button></section>
    </main>

    <footer><a className="brand" href="/"><span className="brand-mark">T</span><span>TECH<span>STORE</span><small>UGANDA</small></span></a><p>Shop smart. Stay connected.</p><small>© {new Date().getFullYear()} Tech Store Uganda</small></footer>

    {cartOpen && <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setCartOpen(false); }}><aside className="drawer"><div className="drawer-head"><div><span className="eyebrow">YOUR SELECTION</span><h2>Shopping cart</h2></div><button className="close" onClick={() => setCartOpen(false)}><X/></button></div>
      {!cart.length ? <div className="empty"><ShoppingBag/><h3>Your cart is empty</h3><p>Add products from the catalogue to get started.</p></div> : <><div className="cart-items">{cart.map((p) => <div className="cart-row" key={p.id}><div className="cart-thumb">{p.image_url ? <img src={p.image_url} alt=""/> : <Laptop/>}</div><div className="cart-copy"><b>{p.name}</b><strong>{money(p.price_ugx)}</strong><div className="qty"><button onClick={() => quantity(p.id, -1)}><Minus size={13}/></button>{p.quantity}<button onClick={() => quantity(p.id, 1)}><Plus size={13}/></button></div></div></div>)}</div><div className="total"><span>Subtotal</span><b>{money(total)}</b></div><button className="checkout" onClick={() => { setCartOpen(false); setCheckoutOpen(true); }}>Continue to checkout <ArrowRight size={17}/></button></>}
    </aside></div>}

    {checkoutOpen && <div className="overlay"><section className="checkout-modal"><div className="drawer-head"><div><span className="eyebrow">ORDER REQUEST</span><h2>Checkout</h2></div><button className="close" onClick={() => setCheckoutOpen(false)}><X/></button></div><form onSubmit={placeOrder}>
      <label>Full name<input required value={customer.name} onChange={(e) => setCustomer({...customer,name:e.target.value})}/></label>
      <label>Phone number<input required value={customer.phone} onChange={(e) => setCustomer({...customer,phone:e.target.value})} placeholder="+256..."/></label>
      {cart.some((p) => p.product_type === 'physical') && <><label>District<input value={customer.district} onChange={(e) => setCustomer({...customer,district:e.target.value})}/></label><label>Town / area<input value={customer.town} onChange={(e) => setCustomer({...customer,town:e.target.value})}/></label><label>Delivery address<input value={customer.address} onChange={(e) => setCustomer({...customer,address:e.target.value})}/></label></>}
      <div className="total"><span>{count} item(s)</span><b>{money(total)}</b></div><button className="checkout" disabled={busy}>{busy ? 'Submitting...' : 'Place order request'} <ArrowRight size={17}/></button><p className="fine-print">Final delivery charges and payment instructions will be confirmed before fulfilment.</p>
    </form></section></div>}
    {notice && <div className="toast">{notice}<button onClick={() => setNotice('')}><X size={14}/></button></div>}
  </div>;
}
createRoot(document.getElementById('root')).render(<App />);
