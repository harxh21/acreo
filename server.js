require('dotenv').config()
const express=require('express'),cors=require('cors'),mongoose=require('mongoose'),bcrypt=require('bcryptjs'),jwt=require('jsonwebtoken')
const app=express();app.use(cors({origin:process.env.CLIENT_URL||'*'}));app.use(express.json({limit:'100kb'}))
const {Schema}=mongoose,ref=n=>({type:Schema.Types.ObjectId,ref:n})
const User=mongoose.model('User',new Schema({name:String,email:{type:String,unique:true,lowercase:true},password:String,
 role:{type:String,enum:['farmer','buyer','admin']},phone:String,org:String,city:String,approved:{type:Boolean,default:false}},{timestamps:true}))
const Product=mongoose.model('Product',new Schema({farmer:ref('User'),name:{type:String,required:true},category:String,description:String,image:String,
 price:{type:Number,min:0.01,required:true},minQty:{type:Number,min:0.1,default:1},stock:{type:Number,min:0,default:0},organic:Boolean,
 tiers:[{minKg:{type:Number,min:0.1},price:{type:Number,min:0.01}}],status:{type:String,enum:['published','paused'],default:'published'}},{timestamps:true}))
const Order=mongoose.model('Order',new Schema({buyer:ref('User'),farmer:ref('User'),items:[{product:ref('Product'),name:String,qty:Number,price:Number}],
 total:Number,address:String,date:String,slot:String,payment:{type:String,enum:['upi','cod','bank_transfer']},
 status:{type:String,enum:['placed','confirmed','out_for_delivery','delivered','cancelled'],default:'placed'},
 history:[{status:String,by:ref('User'),at:{type:Date,default:Date.now}}]},{timestamps:true}))
const SLOTS=['6 AM – 9 AM','9 AM – 12 PM','4 PM – 7 PM']
const wrap=f=>(req,res)=>f(req,res).catch(e=>res.status(e.status||400).json({error:e.message}))
const fail=(m,s=400)=>{const e=new Error(m);e.status=s;throw e}
const auth=(...roles)=>async(req,res,next)=>{try{const t=(req.headers.authorization||'').slice(7),{id}=jwt.verify(t,process.env.JWT_SECRET)
 req.user=await User.findById(id);if(!req.user)throw 0;if(roles.length&&!roles.includes(req.user.role))return res.status(403).json({error:'Not allowed'});next()}
 catch{res.status(401).json({error:'Please log in'})}}
const pub=u=>({id:u._id,name:u.name,email:u.email,role:u.role,approved:u.approved})
const token=u=>jwt.sign({id:u._id},process.env.JWT_SECRET,{expiresIn:'7d'})
const unit=(p,q)=>{const t=p.tiers.filter(t=>t.minKg<=q).sort((a,b)=>b.minKg-a.minKg)[0];return t?t.price:p.price}

app.get('/',(_,r)=>r.json({ok:true,app:'acreo'}))
app.post('/api/signup',wrap(async(q,r)=>{const {name,email,password,role,phone,org,city}=q.body
 if(!name||!email||!password||password.length<6)fail('Name, email and a password of 6+ characters are required')
 if(!['farmer','buyer'].includes(role))fail('Choose farmer or buyer')
 if(await User.findOne({email:String(email).toLowerCase()}))fail('This email is already registered')
 const u=await User.create({name,email,phone,org,city,role,password:await bcrypt.hash(password,10),approved:role==='buyer'});r.json({token:token(u),user:pub(u)})}))
app.post('/api/login',wrap(async(q,r)=>{const u=await User.findOne({email:String(q.body.email||'').toLowerCase()})
 if(!u||!await bcrypt.compare(q.body.password||'',u.password))fail('Wrong email or password',401);r.json({token:token(u),user:pub(u)})}))
app.get('/api/me',auth(),(q,r)=>r.json(pub(q.user)))

const farmerView='name org city approved'
app.get('/api/products',wrap(async(q,r)=>{const ok=(await User.find({role:'farmer',approved:true}).select('_id')).map(x=>x._id)
 r.json(await Product.find({status:'published',stock:{$gt:0},farmer:{$in:ok}}).populate('farmer',farmerView).sort('-createdAt').limit(200))}))
app.get('/api/products/mine',auth('farmer'),wrap(async(q,r)=>r.json(await Product.find({farmer:q.user._id}).sort('-createdAt'))))
app.get('/api/products/:id',wrap(async(q,r)=>{const p=await Product.findById(q.params.id).populate('farmer',farmerView);if(!p||p.status!=='published')fail('Product not found',404);r.json(p)}))
const clean=b=>({name:b.name,category:b.category,description:b.description,image:b.image,price:+b.price,minQty:+b.minQty||1,stock:+b.stock||0,organic:!!b.organic,
 tiers:(b.tiers||[]).slice(0,3).filter(t=>t.minKg>0&&t.price>0).map(t=>({minKg:+t.minKg,price:+t.price}))})
app.post('/api/products',auth('farmer'),wrap(async(q,r)=>{if(!q.user.approved)fail('Your farm is not approved yet',403);r.json(await Product.create({...clean(q.body),farmer:q.user._id}))}))
app.patch('/api/products/:id',auth('farmer','admin'),wrap(async(q,r)=>{const p=await Product.findById(q.params.id);if(!p)fail('Not found',404)
 if(q.user.role==='farmer'&&String(p.farmer)!==String(q.user._id))fail('Not your product',403)
 if(['published','paused'].includes(q.body.status))p.status=q.body.status;if(q.user.role==='farmer'&&q.body.stock!==undefined&&q.body.stock>=0)p.stock=+q.body.stock;r.json(await p.save())}))
app.delete('/api/products/:id',auth('farmer','admin'),wrap(async(q,r)=>{const p=await Product.findById(q.params.id);if(!p)fail('Not found',404)
 if(q.user.role==='farmer'&&String(p.farmer)!==String(q.user._id))fail('Not your product',403);await p.deleteOne();r.json({ok:true})}))

// Place order: price and stock are decided here, never by the browser.
app.post('/api/orders',auth('buyer'),wrap(async(q,r)=>{const {items,address,date,slot,payment}=q.body
 if(!Array.isArray(items)||!items.length)fail('Your cart is empty');if(!address||String(address).length<8)fail('Enter a full delivery address')
 if(!SLOTS.includes(slot))fail('Choose a delivery slot');if(!['upi','cod','bank_transfer'].includes(payment))fail('Choose a payment method')
 if(!date||new Date(date)<=new Date(new Date().toDateString()))fail('Delivery date must be tomorrow or later')
 const taken=[],byFarmer={}
 try{for(const it of items){const qty=+it.qty;if(!(qty>0))fail('Invalid quantity')
   const p=await Product.findOneAndUpdate({_id:it.productId,status:'published',stock:{$gte:qty},minQty:{$lte:qty}},{$inc:{stock:-qty}},{new:true})
   if(!p){const x=await Product.findById(it.productId);fail(x?`${x.name}: order ${x.minQty}–${x.stock} kg`:'A product is no longer available')}
   taken.push({id:p._id,qty});(byFarmer[p.farmer]??=[]).push({product:p._id,name:p.name,qty,price:unit(p,qty)})}
  const out=[];for(const f in byFarmer){const its=byFarmer[f];out.push(await Order.create({buyer:q.user._id,farmer:f,items:its,total:its.reduce((s,i)=>s+i.qty*i.price,0),
   address,date,slot,payment,history:[{status:'placed',by:q.user._id}]}))}
  r.json(out)}
 catch(e){for(const t of taken)await Product.updateOne({_id:t.id},{$inc:{stock:t.qty}});throw e}}))
app.get('/api/orders',auth(),wrap(async(q,r)=>{const f=q.user.role==='buyer'?{buyer:q.user._id}:q.user.role==='farmer'?{farmer:q.user._id}:{}
 r.json(await Order.find(f).populate('buyer','name org phone').populate('farmer','name org').sort('-createdAt').limit(200))}))
app.patch('/api/orders/:id/status',auth('buyer','farmer'),wrap(async(q,r)=>{const o=await Order.findById(q.params.id);if(!o)fail('Order not found',404);const s=q.body.status
 const isF=String(o.farmer)===String(q.user._id),isB=String(o.buyer)===String(q.user._id);let ok=false
 if(isF)ok=(o.status==='placed'&&['confirmed','cancelled'].includes(s))||(o.status==='confirmed'&&['out_for_delivery','cancelled'].includes(s))||(o.status==='out_for_delivery'&&s==='delivered')
 else if(isB)ok=o.status==='placed'&&s==='cancelled'
 if(!ok)fail('This status change is not allowed',403)
 if(s==='cancelled')for(const i of o.items)await Product.updateOne({_id:i.product},{$inc:{stock:i.qty}})
 o.status=s;o.history.push({status:s,by:q.user._id});r.json(await o.save())}))

app.get('/api/admin/users',auth('admin'),wrap(async(q,r)=>r.json((await User.find({role:{$ne:'admin'}}).sort('-createdAt')).map(u=>({...pub(u),phone:u.phone,org:u.org,city:u.city})))))
app.patch('/api/admin/users/:id',auth('admin'),wrap(async(q,r)=>{const u=await User.findOneAndUpdate({_id:q.params.id,role:'farmer'},{approved:!!q.body.approved},{new:true});if(!u)fail('Farmer not found',404);r.json(pub(u))}))
app.get('/api/admin/products',auth('admin'),wrap(async(q,r)=>r.json(await Product.find().populate('farmer','name').sort('-createdAt').limit(200))))

mongoose.connect(process.env.MONGO_URI).then(async()=>{
 if(process.env.ADMIN_EMAIL&&process.env.ADMIN_PASSWORD&&!await User.findOne({email:process.env.ADMIN_EMAIL.toLowerCase()}))
  await User.create({name:'Admin',email:process.env.ADMIN_EMAIL,password:await bcrypt.hash(process.env.ADMIN_PASSWORD,10),role:'admin',approved:true})
 app.listen(process.env.PORT||5000,()=>console.log('Acreo API running'))}).catch(e=>{console.error('MongoDB connection failed:',e.message);process.exit(1)})
