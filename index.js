const express = require('express');
const connectDB = require('./services/connectiondb');
const app = express();
const cors = require('cors');
require('dotenv').config();
connectDB();
app.use(cors());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
const userApi = require('./services/user.service');

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

// Use the user API routes
app.use('/api', userApi);

const listener = app.listen(process.env.PORT || 8000, () => {
  console.log('Your app is listening on port ' + listener.address().port);
});
