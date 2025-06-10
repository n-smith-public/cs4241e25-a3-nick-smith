const express = require('express');
const bodyParser = require('body-parser');
const { body, validationResult } = require('express-validator');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const modRewrite = require('connect-modrewrite');
const moment = require('moment');
const cookieParser = require('cookie-parser')
const { MongoClient } = require('mongodb');
const { ObjectId } = require('mongodb');


const app = express();
const port = process.env.PORT || 3000;

require('dotenv').config();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

/* MongoDB Configuration */
const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/magnolia';
const mongoClient = new MongoClient(mongoURI);
const dbName = 'Magnolia';
let usersCollection, tasksCollection;

mongoClient.connect().then(client => {
    const db = client.db(dbName);
    usersCollection = db.collection('users');
    tasksCollection = db.collection('tasks');
    console.log('Connected to MongoDB');
}).catch(err => {
    console.error('Failed to connect to MongoDB:', err.message);
});

app.post('/updateDisplayName', async (req, res) => {
    if (!req.cookies.auth || req.cookies.auth !== 'true' || !req.cookies.email) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    const { displayName } = req.body;
    if (!displayName || !displayName.trim()) {
        return res.status(400).json({ error: 'Display name is required.' });
    }
    const email = req.cookies.email;
    const result = await usersCollection.updateOne(
        { email },
        { $set: { displayName: displayName.trim() } }
    );
    if (result.modifiedCount === 1) {
        res.cookie('displayName', displayName, { httpOnly: false, secure: false, maxAge: 60 * 60 * 1000 });
        res.json({ status: 'success', message: 'Display name updated successfully.' });
    } else {
        res.status(500).json({ status: 'error', message: 'User not found or not updated.' });
    }
})

/* Handle the website display and routing */
/* -- Static Files --  */
app.use('/css', express.static(path.join(__dirname, 'public', '/css')));
app.use('/media', (req, res, next) => {
    if (req.url.endsWith('.png')) {
        res.set('Content-Type', 'image/png');
    }
    next();
}, express.static(path.join(__dirname, 'public', '/media')));
app.use('/js', express.static(path.join(__dirname, 'public', '/js')));

/* -- Prevent user from accessing protected pages if not logged in -- */
app.use((req, res, next) => {
    const publicEndpoints = ['/login', '/register', '/sendOTP', '/verifyOTP', '/registerUser' ];
    const staticElements = req.path.startsWith('/css') || req.path.startsWith('/media') || req.path.startsWith('/js');
    if (publicEndpoints.includes(req.path) || staticElements ) {
        return next();
    }
    if (req.cookies.auth === 'true') {
        return next();
    } else {
        return res.redirect('/login');
    }
});

app.get('/home', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/tasks', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'tasks.html'));
});

/* -- Prevent logged in users from accessing login and register pages -- */
app.use(['/login', '/register'], (req, res, next) => {
    if (req.cookies.auth === 'true') {
        return res.redirect('/home');
    }
    next();
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/', (req, res) => {
    if (req.cookies.auth === 'true') {
        return res.redirect('/home');
    }
    return res.redirect('/login');
});

app.use((req, res, next) => {
    if (!usersCollection || !tasksCollection) {
        return res.status(503).json({ error: 'Database not ready. Please try again later.' });
    }
    next();
});

/* Email Configuration */
const confEmail = process.env.CONFIRMATION_EMAIL;
const confPass = process.env.CONFIRMATION_PASSWORD;
const transporter = nodemailer.createTransport({
    service: 'Zoho',
    port: 465,
    secure: true,
    auth: {
        user: confEmail,
        pass: confPass
    },
    tls: {
        rejectUnauthorized: true
    }
});

/* Setup for Login and Registration */
let otp = '';
let expiration = 0;

/* -- Generates a new OTP for the user that expires after 5 minutes -- */
const generateOTP = () => {
    otp = crypto.randomBytes(6).toString('hex');
    expiration = moment().add(5, 'minutes').valueOf();
    return { code: otp, expiration };
}

/* -- Midleware that sends the OTP to the user via the provided email -- */
app.post('/sendOTP', async (req, res) => {
    try {
        const { email} = req.body;
        const user = await usersCollection.findOne({ email });
        if (!user) {
            return res.status(404).json({ status: 'error', message: 'User not found.' });
        }
        const { code } = generateOTP();

        const emailTemplate = fs.readFileSync(path.join(__dirname, 'emailTemplate.html'), 'utf8');
        const emailContent = emailTemplate.replace('{{otp}}', code);

        await transporter.sendMail({
            from: 'Magnolia <greenbueller@greenbueller.com>',
            to: req.body.email,
            subject: 'Your OTP Code',
            html: emailContent,
            text: `Your OTP code is ${code}. It will expire in 5 minutes.`
        });
        res.status(200).json({ status: 'success', message: 'OTP sent successfully.' });
    } catch (error) {
        console.error('Error sending OTP:', error);
        res.status(500).json({ status: 'error', message: 'Failed to send OTP.' });
    }
});

/* -- Middleware that verifies if the OTP provided by the user is correct and not expired -- */
app.post('/verifyOTP', async (req, res) => {
    const { code, email } = req.body;

    if (code !== otp) {
        return res.status(403).json({ error: 'Invalid OTP code.' });
    }

    const currentTime = moment().valueOf();
    if (currentTime > expiration) {
        return res.status(403).json({ error: 'OTP code has expired.' });
    }
    const user = await usersCollection.findOne({ email });
    if (!user) {
        return res.status(404).json({ error: 'User not found.' });
    }
    res.cookie('auth', 'true', { httpOnly: true, secure: true, maxAge: 60 * 60 * 1000 });
    res.cookie('displayName', user.displayName, { httpOnly: false, secure: true, maxAge: 60 * 60 * 1000 });
    res.cookie('email', user.email, { httpOnly: true, secure: true, maxAge: 60 * 60 * 1000 });
    res.status(200).json({ status: 'success', message: 'OTP verified successfully.' });
});

app.post('/registerUser', async (req, res) => {
    const { displayName, email } = req.body;

    if (!displayName || !email) {
        return res.status(400).json({ error: 'Display name and email are required.' });
    }

    try {
        const existing = await usersCollection.findOne( { email });
        if (existing) {
            return res.status(409).json({ error: 'User already exists with this email.' });
        }
        await usersCollection.insertOne({ displayName, email });

        const { code } = generateOTP();

        const emailTemplate = fs.readFileSync(path.join(__dirname, 'emailTemplate.html'), 'utf8');
        const emailContent = emailTemplate.replace('{{otp}}', code);

        await transporter.sendMail({
            from: 'Magnolia <greenbueller@greenbueller.com>',
            to: req.body.email,
            subject: 'Your OTP Code',
            html: emailContent,
            text: `Your OTP code is ${code}. It will expire in 5 minutes.`
        });
        res.status(200).json({ status: 'success', message: 'OTP sent successfully.' });
    } catch (error) {
        console.error('Error sending OTP:', error);
        res.status(500).json({ status: 'error', message: 'Failed to send OTP.' });
    }
});

app.get('/logout', (req, res) => {
    res.clearCookie('auth');
    res.clearCookie('displayName');
    res.clearCookie('email');
    res.redirect('/login');
})

/* Handle all things tasks */
/* -- Middleware to add a new task -- */
app.post('/submit', async (req, res) => {
    if (!req.cookies.auth || req.cookies.auth !== 'true' || !req.cookies.email) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    const email = req.cookies.email;
    const { taskName, taskDescription, taskDueDate, taskPriority } = req.body;
    if (!taskName || !taskDescription || !taskDueDate || !taskPriority) {
        return res.status(400).json({ error: 'All fields are required.' });
    }
    const task = {
        email, taskName, taskDescription, taskDueDate, taskPriority, completed: false
    };
    const result = await tasksCollection.insertOne(task);
    if (result.acknowledged) {
        res.status(201).json({ status: 'success', message: 'Task added successfully.' });
    } else {
        res.status(500).json({ status: 'error', message: 'Failed to add task.' });
    }
});

/* -- Midleware to fetch all tasks for the user -- */
app.get('/entries', async (req, res) => {
    if (!req.cookies.auth || req.cookies.auth !== 'true' || !req.cookies.email) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    const email = req.cookies.email;
    const tasks = await tasksCollection.find({ email }).toArray();
    tasks.forEach(task => {
        task.id = task._id.toString();
    })
    res.json(tasks);
});

app.post('/deleteTask', async (req, res) => {
    if (!req.cookies.auth || req.cookies.auth !== 'true' || !req.cookies.email) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    const email = req.cookies.email;
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'No task IDs provided.' });
    }
    const objectIds = ids.map(id => new ObjectId(id));
    const result = await tasksCollection.deleteMany({ _id: { $in: objectIds }, email });
    if (result.deletedCount > 0) {
        res.status(200).json({ status: 'success', message: 'Tasks deleted successfully.' });
    } else {
        res.status(404).json({ status: 'error', message: 'No tasks found for the provided IDs.' });
    }
})

app.post('/editTask', async (req, res) => {
    if (!req.cookies.auth || req.cookies.auth !== 'true' || !req.cookies.email) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    const { id, taskName, taskDescription, taskDueDate, taskPriority } = req.body;
    if (!id || !taskName || !taskDescription || !taskDueDate || !taskPriority) {
        return res.status(400).json({ error: 'All fields are required.' });
    }
    const result = await tasksCollection.updateOne(
        { _id: new ObjectId(id), email: req.cookies.email },
        { $set: { taskName, taskDescription, taskDueDate, taskPriority } }
    );
    if (result.modifiedCount === 1) res.json({ status: 'success', message: 'Task updated successfully.' });
    else res.status(404).json({ status: 'error', message: 'Task not found or not updated.' });
});

/* -- Middleware to update a task's completion status -- */
app.post('/complete', async (req, res) => {
    if (!req.cookies.auth || req.cookies.auth !== 'true' || !req.cookies.email) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    const email = req.cookies.email;
    const { id, completed } = req.body;
    if (!id) return res.status(400).json({ error: 'Task ID is required.' });
    await tasksCollection.updateOne(
        { _id: new ObjectId(id), email: email },
        { $set: { completed: !!completed } }
    );
    res.status(200).json({ status: 'success', message: 'Task updated successfully.' });
})

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});