const express = require('express');
const connectDB = require('./config/db');
require('dotenv').config();
const app = express();
const PORT = 3000;
connectDB();
const cors = require('cors');
 app.use(cors());
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));
const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));




const requestRoutes = require('./routes/requestRoutes');
app.use('/api', requestRoutes);



const supplierRoutes = require('./routes/supplierRoutes');
app.use('/api', supplierRoutes);


const authRoutes = require('./routes/authRoutes');
app.use('/api', authRoutes);


app.get('/', (req, res) => {
  res.redirect('/home.html');
})

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})