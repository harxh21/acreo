const API=window.API_URL,$=s=>document.querySelector(s),SLOTS=['6 AM – 9 AM','9 AM – 12 PM','4 PM – 7 PM'],CATS=['Leafy greens','Root vegetables','Fruit vegetables','Onion & garlic','Fruits','Other']
const LBL={placed:'Placed',confirmed:'Confirmed',out_for_delivery:'Out for delivery',delivered:'Delivered',cancelled:'Cancelled'}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const inr=n=>'₹'+Number(n).toLocaleString('en-IN',{maximumFractionDigits:2})
let user=JSON.parse(localStorage.getItem('u')||'null'),cart=JSON.parse(localStorage.getItem('c')||'[]'),cache=[]
const persist=()=>{localStorage.setItem('c',JSON.stringify(cart));user?localStorage.setItem('u',JSON.stringify(user)):localStorage.removeItem('u')}
function toast(m,bad){const t=$('#toast');t.textContent=m;t.className=bad?'bad':'';t.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(()=>t.style.display='none',3500)}
async function api(p,m='GET',b){const r=await fetch(API+p,{method:m,headers:{'Content-Type':'application/json',...(localStorage.getItem('t')?{Authorization:'Bearer '+localStorage.getItem('t')}:{})},body:b?JSON.stringify(b):undefined})
 const d=await r.json().catch(()=>({}));if(r.status===401&&localStorage.getItem('t'))logout(true);if(!r.ok)throw new Error(d.error||'Something went wrong');return d}
const run=f=>async(...a)=>{try{await f(...a)}catch(e){toast(e.message,1)}}
const unit=(p,q)=>{const t=(p.tiers||[]).filter(t=>t.minKg<=q).sort((a,b)=>b.minKg-a.minKg)[0];return t?t.price:p.price}
const home=()=>!user?'#/':user.role==='farmer'?'#/farmer':user.role==='admin'?'#/admin':'#/market'
function logout(silent){localStorage.removeItem('t');user=null;persist();location.hash='#/';if(!silent)toast('Signed out')}
function nav(){const L={buyer:[['market','Marketplace'],['cart','Cart ('+cart.length+')'],['orders','My orders']],farmer:[['farmer','Dashboard'],['orders','Orders']],admin:[['admin','Admin']]}
 $('#nav').innerHTML=(user?L[user.role].map(([h,l])=>`<a href="#/${h}" class="${location.hash==='#/'+h?'on':''}">${l}</a>`).join('')+'<span style="flex:1"></span><button onclick="logout()">Sign out</button>':'<span style="flex:1"></span><a href="#/login">Log in</a>')}
const need=(...r)=>{if(!user){location.hash='#/login';return false}if(!r.includes(user.role)){location.hash=home();return false}return true}
const chip=s=>`<span class="chip s-${s}">${LBL[s]}</span>`
const where=p=>esc([p.farmer?.org,p.farmer?.city].filter(Boolean).join(', '))
const pic=(p,c)=>p.image?`<img class="${c}" src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">`:`<div class="${c} ph muted">No photo</div>`

const V={}
V.home=()=>user?(location.hash=home()):$('#app').innerHTML=`<section class="hero"><h1>Vegetables from the farm that grew them, to your kitchen.</h1>
 <p>Verified local farmers sell directly to hostels, PGs and mess kitchens. Order in bulk, pick a delivery slot, and track your order status from Placed to Delivered.</p>
 <p><a class="btn" style="background:var(--carrot)" href="#/login?signup&buyer">I buy for a kitchen</a> <a class="btn ghost" style="color:#fff;border-color:#fff8" href="#/login?signup&farmer">I grow produce</a></p></section>
 <div class="grid">${[['Farmers list','Add produce with a photo link, per-kg price, minimum order, stock and bulk tiers.'],['Buyers order','Search, fill a cart, and place one order per farmer with a delivery date and slot.'],['Admin verifies','Every farmer is approved by an admin before their produce is shown.']].map(([t,d])=>`<div class="card"><h3>${t}</h3><p>${d}</p></div>`).join('')}</div>
 <div class="card"><h3>How payment works</h3><p>Acreo does not collect money. Agree payment directly with the other party (UPI, bank transfer or cash).</p></div>`
V.login=()=>{if(user)return location.hash=home();const q=location.hash;let signup=q.includes('signup'),role=q.includes('farmer')?'farmer':'buyer'
 const draw=()=>{$('#app').innerHTML=`<form class="card" style="max-width:440px;margin:auto" id="f"><h2>${signup?'Create your account':'Log in'}</h2>
  ${signup?`<div class="two"><button type="button" class="btn ${role==='buyer'?'':'ghost'}" data-r="buyer">Buyer (kitchen)</button><button type="button" class="btn ${role==='farmer'?'':'ghost'}" data-r="farmer">Farmer</button></div>
  <label>Full name<input name="name" required></label><label>Phone<input name="phone" required></label><label>${role==='buyer'?'Hostel / PG / restaurant name':'Farm name'}<input name="org" required></label><label>City or village<input name="city" required></label>`:''}
  <label>Email<input name="email" type="email" required></label><label>Password (min 6 characters)<input name="password" type="password" minlength="6" required></label>
  <p><button class="btn" style="width:100%">${signup?'Create account':'Log in'}</button></p>
  <p><a href="#" id="sw">${signup?'Have an account? Log in':'New here? Sign up'}</a></p></form>`
  $('#sw').onclick=e=>{e.preventDefault();signup=!signup;draw()};document.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>{role=b.dataset.r;draw()})
  $('#f').onsubmit=run(async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(e.target));if(signup)b.role=role
   const d=await api(signup?'/signup':'/login','POST',b);localStorage.setItem('t',d.token);user=d.user;persist();location.hash=home()})};draw()}

V.market=async()=>{if(!need('buyer'))return;$('#app').innerHTML='<p>Loading produce…</p>';cache=await api('/products')
 $('#app').innerHTML=`<h1>Fresh from the farm</h1><div class="card two" style="grid-template-columns:2fr 1fr 1fr 1fr"><label>Search<input id="q" placeholder="Tomato, onion…"></label>
 <label>Category<select id="c"><option value="">All</option>${CATS.map(c=>`<option>${c}</option>`).join('')}</select></label><label>Max ₹/kg<input id="m" type="number" min="0"></label>
 <label>Sort<select id="s"><option value="n">Newest</option><option value="l">Price low–high</option><option value="h">Price high–low</option></select></label></div><div class="grid" id="list"></div>`
 const draw=()=>{let l=cache.filter(p=>p.name.toLowerCase().includes($('#q').value.toLowerCase())&&(!$('#c').value||p.category===$('#c').value)&&(!$('#m').value||p.price<=+$('#m').value))
  if($('#s').value==='l')l.sort((a,b)=>a.price-b.price);if($('#s').value==='h')l.sort((a,b)=>b.price-a.price)
  $('#list').innerHTML=l.length?l.map(p=>`<a class="card pc" href="#/p/${p._id}">${pic(p,'')}<div class="in"><h3>${esc(p.name)} ${p.organic?'<span class="chip">Organic</span>':''}</h3><b style="color:var(--fresh)">${inr(p.price)} / kg</b>
   <div class="muted">Min ${p.minQty} kg · ${p.stock} kg in stock</div><div class="muted">${esc(p.farmer?.name)} · ${where(p)}</div></div></a>`).join(''):'<div class="card">No produce matches yet. Try clearing the filters.</div>'}
 ['q','c','m','s'].forEach(i=>$('#'+i).oninput=draw);draw()}
V.p=async id=>{if(!need('buyer'))return;const p=await api('/products/'+id),t=[...p.tiers].sort((a,b)=>a.minKg-b.minKg)
 $('#app').innerHTML=`<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))"><div>${pic(p,'')}</div><div><a href="#/market">← Back</a><h1>${esc(p.name)}</h1><p>${esc(p.description)}</p>
 <div class="card"><b>Price per kg</b><table><tr><td>From ${p.minQty} kg</td><td>${inr(p.price)}</td></tr>${t.map(x=>`<tr><td>${x.minKg} kg and above</td><td>${inr(x.price)}</td></tr>`).join('')}</table></div>
 <p class="muted">${p.stock} kg in stock ${p.organic?'· Organic':''} · Sold by ${esc(p.farmer?.name)}, ${where(p)}</p>
 <div class="card"><label>Quantity (kg)<input id="qty" type="number" min="${p.minQty}" max="${p.stock}" value="${p.minQty}"></label><p><b id="tot"></b></p><button class="btn" id="add">Add to cart</button></div></div></div>`
 const upd=()=>{const q=+$('#qty').value,ok=q>=p.minQty&&q<=p.stock;$('#tot').textContent=ok?`${inr(unit(p,q))}/kg · Total ${inr(unit(p,q)*q)}`:`Enter between ${p.minQty} and ${p.stock} kg`;$('#add').disabled=!ok}
 $('#qty').oninput=upd;upd();$('#add').onclick=()=>{const q=+$('#qty').value;cart=cart.filter(i=>i.id!==p._id);cart.push({id:p._id,qty:q,p:{name:p.name,price:p.price,tiers:p.tiers,minQty:p.minQty,stock:p.stock,farmer:p.farmer?.name}});persist();nav();toast('Added to cart')}}

V.cart=()=>{if(!need('buyer'))return;if(!cart.length)return $('#app').innerHTML='<div class="card">Your cart is empty. <a href="#/market">Browse produce</a></div>'
 const tm=new Date(Date.now()+864e5).toISOString().slice(0,10),tot=cart.reduce((s,i)=>s+unit(i.p,i.qty)*i.qty,0)
 $('#app').innerHTML=`<h1>Your cart</h1><div class="card"><table>${cart.map((i,k)=>`<tr><td><b>${esc(i.p.name)}</b><div class="muted">${esc(i.p.farmer)} · min ${i.p.minQty} kg · ${i.p.stock} kg in stock</div></td>
 <td style="width:110px"><input type="number" aria-label="Quantity in kg" min="${i.p.minQty}" max="${i.p.stock}" value="${i.qty}" onchange="cart[${k}].qty=+this.value;persist();V.cart()"></td><td>${inr(unit(i.p,i.qty)*i.qty)}</td>
 <td><button class="btn danger" onclick="cart.splice(${k},1);persist();nav();V.cart()">Remove</button></td></tr>`).join('')}</table><h3>Total ${inr(tot)}</h3><p class="muted">Orders are split per farmer. The server recalculates the final price.</p></div>
 <form class="card" id="co"><h2>Checkout</h2><label>Delivery address<textarea name="address" rows="2" required placeholder="Name, phone, street, city, pincode"></textarea></label>
 <div class="two"><label>Delivery date<input name="date" type="date" min="${tm}" required></label><label>Slot<select name="slot">${SLOTS.map(s=>`<option>${s}</option>`).join('')}</select></label></div>
 <label>Payment method (settled outside Acreo)<select name="payment"><option value="upi">UPI</option><option value="cod">Cash on delivery</option><option value="bank_transfer">Bank transfer</option></select></label>
 <p><button class="btn">Place order</button></p></form>`
 $('#co').onsubmit=run(async e=>{e.preventDefault();await api('/orders','POST',{...Object.fromEntries(new FormData(e.target)),items:cart.map(i=>({productId:i.id,qty:i.qty}))});cart=[];persist();nav();toast('Order placed');location.hash='#/orders'})}

V.orders=async()=>{if(!need('buyer','farmer'))return;const L=await api('/orders'),F=user.role==='farmer'
 const act=o=>F?({placed:[['confirmed','Accept']],confirmed:[['out_for_delivery','Dispatch']],out_for_delivery:[['delivered','Mark delivered']]}[o.status]||[]).map(([s,l])=>`<button class="btn" onclick="setS('${o._id}','${s}')">${l}</button>`).join('')
  +(['placed','confirmed'].includes(o.status)?`<button class="btn danger" onclick="setS('${o._id}','cancelled')">${o.status==='placed'?'Decline':'Cancel'}</button>`:''):(o.status==='placed'?`<button class="btn danger" onclick="setS('${o._id}','cancelled')">Cancel order</button>`:'')
 const steps=o=>o.status==='cancelled'?'':`<div class="steps">${['placed','confirmed','out_for_delivery','delivered'].map((s,i)=>`<div class="${i<=['placed','confirmed','out_for_delivery','delivered'].indexOf(o.status)?'on':''}">${LBL[s]}</div>`).join('')}</div>`
 $('#app').innerHTML=`<h1>${F?'Orders':'My orders'}</h1>`+(L.length?L.map(o=>`<div class="card"><div class="row"><b>${F?esc(o.buyer?.org||o.buyer?.name)+' · '+esc(o.buyer?.phone):esc(o.farmer?.name)}</b>${chip(o.status)}</div>${steps(o)}
  <p>${o.items.map(i=>`${esc(i.name)} ${i.qty} kg @ ${inr(i.price)}`).join(' · ')}</p><p class="muted">Deliver ${esc(o.date)}, ${esc(o.slot)} · ${esc(o.payment.replace('_',' '))} · ${esc(o.address)}</p>
  <div class="row"><b>Total ${inr(o.total)}</b><span>${act(o)}</span></div></div>`).join(''):'<div class="card">No orders yet.</div>')}
const setS=run(async(id,s)=>{if(s==='cancelled'&&!confirm('Cancel this order? Stock will be returned.'))return;await api(`/orders/${id}/status`,'PATCH',{status:s});toast('Order updated');V.orders()})

V.farmer=async()=>{if(!need('farmer'))return;const me=await api('/me');user=me;persist();const L=await api('/products/mine')
 $('#app').innerHTML=`<h1>Hello, ${esc(me.name)}</h1>`+(!me.approved?'<div class="card" style="border-color:var(--turmeric)"><h3>Waiting for admin approval</h3><p>You can add produce once an admin approves your farm.</p></div>':`
 <details class="card"><summary><b>Add a product</b></summary><form id="pf"><div class="two"><label>Name<input name="name" required></label><label>Category<select name="category">${CATS.map(c=>`<option>${c}</option>`).join('')}</select></label></div>
 <label>Description<textarea name="description" rows="2"></textarea></label><label>Photo link (image URL, optional)<input name="image" type="url"></label>
 <div class="two"><label>Base price per kg (₹)<input name="price" type="number" step="0.01" min="0.01" required></label><label>Minimum order (kg)<input name="minQty" type="number" step="0.1" min="0.1" value="1" required></label></div>
 <div class="two"><label>Stock (kg)<input name="stock" type="number" step="0.1" min="0" required></label><label>Organic<select name="organic"><option value="">No</option><option value="1">Yes</option></select></label></div>
 <p class="muted">Bulk tiers (optional, up to 3): from kg → ₹ per kg</p><div class="two">${[1,2,3].map(i=>`<input name="k${i}" type="number" min="0" step="0.1" placeholder="From kg" aria-label="Tier ${i} from kg"><input name="p${i}" type="number" min="0" step="0.01" placeholder="₹ per kg" aria-label="Tier ${i} price">`).join('')}</div>
 <p><button class="btn">Save product</button></p></form></details>
 <h2>My products</h2>`+(L.length?L.map(p=>`<div class="card row"><div><b>${esc(p.name)}</b> <span class="chip">${p.status}</span><div class="muted">${inr(p.price)}/kg · min ${p.minQty} kg · ${p.stock} kg · ${p.tiers.length} tiers</div></div>
  <span><button class="btn ghost" onclick="pst('${p._id}','${p.status==='published'?'paused':'published'}')">${p.status==='published'?'Pause':'Publish'}</button> <button class="btn danger" onclick="pdel('${p._id}')">Delete</button></span></div>`).join(''):'<div class="card">No products yet. Add your first one above.</div>'))
 if($('#pf'))$('#pf').onsubmit=run(async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));f.organic=!!f.organic
  f.tiers=[1,2,3].map(i=>({minKg:+f['k'+i],price:+f['p'+i]})).filter(t=>t.minKg>0&&t.price>0);await api('/products','POST',f);toast('Product saved');V.farmer()})}
const pst=run(async(id,status)=>{await api('/products/'+id,'PATCH',{status});V.farmer()}),pdel=run(async id=>{if(confirm('Delete this product? Past orders keep their details.')){await api('/products/'+id,'DELETE');V.farmer()}})

V.admin=async()=>{if(!need('admin'))return;const [U,P,O]=await Promise.all([api('/admin/users'),api('/admin/products'),api('/orders')])
 $('#app').innerHTML=`<h1>Admin</h1><h2>Users</h2>`+U.map(u=>`<div class="card row"><div><b>${esc(u.name)}</b> <span class="chip">${u.role}</span><div class="muted">${esc(u.org)} · ${esc(u.phone)} · ${esc(u.city)} · ${esc(u.email)}</div></div>
  ${u.role==='farmer'?`<span>${u.approved?'Approved':'Pending'} <button class="btn" onclick="appr('${u.id}',true)">Approve</button> <button class="btn danger" onclick="appr('${u.id}',false)">Reject</button></span>`:''}</div>`).join('')
 +`<h2>Listings</h2>`+P.map(p=>`<div class="card row"><div><b>${esc(p.name)}</b> <span class="chip">${p.status}</span><div class="muted">${esc(p.farmer?.name)} · ${inr(p.price)}/kg · ${p.stock} kg</div></div>
  <span><button class="btn ghost" onclick="pst2('${p._id}')">Pause</button> <button class="btn danger" onclick="pdel2('${p._id}')">Remove</button></span></div>`).join('')
 +`<h2>All orders</h2>`+O.map(o=>`<div class="card row"><span>${esc(o.buyer?.name)} → ${esc(o.farmer?.name)} · ${inr(o.total)} · ${esc(o.date)}</span>${chip(o.status)}</div>`).join('')}
const appr=run(async(id,approved)=>{await api('/admin/users/'+id,'PATCH',{approved});V.admin()}),pst2=run(async id=>{await api('/products/'+id,'PATCH',{status:'paused'});V.admin()}),pdel2=run(async id=>{if(confirm('Remove listing?')){await api('/products/'+id,'DELETE');V.admin()}})

function route(){nav();const [,r,a]=location.hash.replace('#','').split('?')[0].split('/');window.scrollTo(0,0);(run(async()=>{await (V[r||'home']||V.home)(a)}))()}
window.addEventListener('hashchange',route);route()
