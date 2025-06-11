// Import all required modules
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


// Create the Express app
const app = express();
const port = process.env.PORT || 3000;

// Import the dotenv package so I can use a .env file (NOT STORED ON THE REPO)
require('dotenv').config();

// Body Parser and Cookie Parser middleware for future referencing
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

/* MongoDB Configuration */
const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/magnolia';
const mongoClient = new MongoClient(mongoURI);
const dbName = 'Magnolia';
// Two different collections, one for user info and one for tasks
let usersCollection, tasksCollection;

// Connect to MongoDB
mongoClient.connect().then(client => {
    const db = client.db(dbName);
    usersCollection = db.collection('users');
    tasksCollection = db.collection('tasks');
    console.log('Connected to MongoDB');
}).catch(err => {
    console.error('Failed to connect to MongoDB:', err.message);
});

// Middleware for updating a user's display name.
app.post('/updateDisplayName', async (req, res) => {
    // If not logged in, return a 403 forbidden/unauthorized error.
    if (!req.cookies.auth || req.cookies.auth !== 'true' || !req.cookies.email) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    const { displayName } = req.body;
    // If the display name is invalid in some form, return a 400 bad request error.
    if (!displayName || !displayName.trim()) {
        return res.status(400).json({ error: 'Display name is required.' });
    }
    // Otherwise, get the user's email based on the cookie, and update their display name in the database.
    const email = req.cookies.email;
    const result = await usersCollection.updateOne(
        { email },
        { $set: { displayName: displayName.trim() } }
    );
    // If the update was successful (one user was modified), update the cookie and return a success.
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

/* -- Robots.txt for Lighthouse -- */
app.get('/robots.txt', (req, res) => {
    res.type('text/plain');
    res.send(path.join(__dirname, 'robots.txt'));
});

/* -- Prevent user from accessing protected pages if not logged in -- */
app.use((req, res, next) => {
    // Anything that can be publicly accessed, such as registration/login pages and the associated endpoints, as well as static files
    const publicEndpoints = ['/login', '/register', '/sendOTP', '/verifyOTP', '/registerUser', '/robots.txt' ];
    const staticElements = req.path.startsWith('/css') || req.path.startsWith('/media') || req.path.startsWith('/js');
    // If the request is for one of these, pass the user through.
    if (publicEndpoints.includes(req.path) || staticElements ) {
        return next();
    }
    // If the user is logged in, pass them through
    if (req.cookies.auth === 'true') {
        return next();
    } else {
        // Otherwise, bounce the request and send the user back to /login.
        return res.redirect('/login');
    }
});

// This was originally one big option, but it broke the code above this that prevented non-logged in users from accessing protected pages.
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

/* -- Update the root directory based on if the user is logged in or not. -- */
app.get('/', (req, res) => {
    if (req.cookies.auth === 'true') {
        return res.redirect('/home');
    }
    return res.redirect('/login');
});

/* -- This request prevents the user from attempting to do anything if the database is not ready, mainly as a precaution. -- */
app.use((req, res, next) => {
    if (!usersCollection || !tasksCollection) {
        return res.status(503).json({ error: 'Database not ready. Please try again later.' });
    }
    next();
});

/* Email Configuration */
const confEmail = process.env.CONFIRMATION_EMAIL;
const confPass = process.env.CONFIRMATION_PASSWORD;
/* -- NodeMailer Transporter for OTP. Uses my custom domain's email as a base. */
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
        // Get the user's email from the endpoint request
        const { email} = req.body;
        // Find the associated user in the database
        const user = await usersCollection.findOne({ email });
        if (!user) {
            // If the user does not exist, return a 404. Must register an account first.
            return res.status(404).json({ status: 'error', message: 'User not found.' });
        }
        // Generate a new OTP
        const { code } = generateOTP();

        // Use emailTemplate.html to format the email
        const emailTemplate = fs.readFileSync(path.join(__dirname, 'emailTemplate.html'), 'utf8');
        // And replace the {{otp}} placeholder with the generated OTP code
        const emailContent = emailTemplate.replace('{{otp}}', code);

        // Send the email as Magnolia (alias for my custom domain email) to the user's email address
        await transporter.sendMail({
            from: 'Magnolia <greenbueller@greenbueller.com>',
            to: req.body.email,
            subject: 'Your OTP Code',
            html: emailContent,
            text: `Your OTP code is ${code}. It will expire in 5 minutes.`
        });
        // Return a success message
        res.status(200).json({ status: 'success', message: 'OTP sent successfully.' });
    } catch (error) {
        // If there is an error at any point, log it and return a 500 error.
        console.error('Error sending OTP:', error);
        res.status(500).json({ status: 'error', message: 'Failed to send OTP.' });
    }
});

/* -- Middleware that verifies if the OTP provided by the user is correct and not expired -- */
app.post('/verifyOTP', async (req, res) => {
    // Get the OTP code and email from the request body
    const { code, email } = req.body;

    // If the OTP code does not equal the server-side one, return a 403 forbidden error.
    if (code !== otp) {
        return res.status(403).json({ error: 'Invalid OTP code.' });
    }

    // Check if the code has expired
    const currentTime = moment().valueOf();
    if (currentTime > expiration) {
        return res.status(403).json({ error: 'OTP code has expired.' });
    }
    // If it has not expired, check if the user exists in the database.
    const user = await usersCollection.findOne({ email });
    // If the user does not exist, return a 404 error.
    if (!user) {
        return res.status(404).json({ error: 'User not found.' });
    }
    // Otherwise, give the user the cookies required for accessing the website.
    //-- Auth cookie is a boolean for if the user is logged in or not.
    res.cookie('auth', 'true', { httpOnly: true, secure: true, maxAge: 60 * 60 * 1000 });
    //-- Display name cookie is the user's display name, which is used to greet the user.
    res.cookie('displayName', user.displayName, { httpOnly: false, secure: true, maxAge: 60 * 60 * 1000 });
    //-- Email cookie is the user's email, which is used to idenftify the user in the database.
    res.cookie('email', user.email, { httpOnly: true, secure: true, maxAge: 60 * 60 * 1000 });
    // Return a success message.
    res.status(200).json({ status: 'success', message: 'OTP verified successfully.' });
});

/* -- Middleware for registering a new user in the database -- */
app.post('/registerUser', async (req, res) => {
    const { displayName, email } = req.body;

    // If a display name or email is not provided, return a 400 bad request error.
    if (!displayName || !email) {
        return res.status(400).json({ error: 'Display name and email are required.' });
    }

    try {
        // Check to see if the provided email already has an associated account
        const existing = await usersCollection.findOne( { email });
        if (existing) {
            return res.status(409).json({ error: 'User already exists with this email.' });
        }
        // Otherwise, insert the new user into the database.
        await usersCollection.insertOne({ displayName, email });

        // Reuses the same code as /sendOTP to generate a new OTP for the user.
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

/* -- Middleware for logging the user out on request -- */
app.get('/logout', (req, res) => {
    // Clear the cookies that were set when the user logged in.
    res.clearCookie('auth');
    res.clearCookie('displayName');
    res.clearCookie('email');
    // And redirect the user to the login page.
    res.redirect('/login');
})

/* Handle all things tasks */
/* -- Middleware to add a new task -- */
app.post('/submit', async (req, res) => {
    // User must be authenticated to add a task.
    if (!req.cookies.auth || req.cookies.auth !== 'true' || !req.cookies.email) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    // Get the user's email from the cookie
    const email = req.cookies.email;
    // Get the task details from the request body
    const { taskName, taskDescription, taskDueDate, taskPriority } = req.body;
    // If any are missing, return a 400 bad request error.
    if (!taskName || !taskDescription || !taskDueDate || !taskPriority) {
        return res.status(400).json({ error: 'All fields are required.' });
    }
    // Otherwise, store the request body as a constant to pass into the database.
    const task = {
        email, taskName, taskDescription, taskDueDate, taskPriority, completed: false
    };
    // Attempt to insert the task into the database.
    const result = await tasksCollection.insertOne(task);
    // If the insertion was successful, return a 201 created response.
    if (result.acknowledged) {
        res.status(201).json({ status: 'success', message: 'Task added successfully.' });
    } else {
        // Otherwise, return a 500 internal server error.
        res.status(500).json({ status: 'error', message: 'Failed to add task.' });
    }
});

/* -- Midleware to fetch all tasks for the user -- */
app.get('/entries', async (req, res) => {
    // User must be authenticated to fetch tasks.
    if (!req.cookies.auth || req.cookies.auth !== 'true' || !req.cookies.email) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    // Get the user's email from the cookie
    const email = req.cookies.email;
    // Get all of the tasks for the user from the database.
    const tasks = await tasksCollection.find({ email }).toArray();
    tasks.forEach(task => {
        task.id = task._id.toString();
    })
    // Return it as a JSON response which can then be parsed in main.js
    res.json(tasks);
});

/* -- Middleware to delete a provided array of tasks -- */
app.post('/deleteTask', async (req, res) => {
    // User must be authenticated to delete tasks.
    if (!req.cookies.auth || req.cookies.auth !== 'true' || !req.cookies.email) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    // Get the user's email from the cookie
    const email = req.cookies.email;
    // Get the array of task IDs from the request body. Any number greater than 0 is a valid number of tasks.
    const { ids } = req.body;
    // If the ids array is empty or not an array, return a 400 bad request error.
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'No task IDs provided.' });
    }
    // Otherwise, convert the string IDs from the website to ObjectId objects for MongoDB.
    const objectIds = ids.map(id => new ObjectId(id));
    // Attempt to delete the tasks from the database.
    const result = await tasksCollection.deleteMany({ _id: { $in: objectIds }, email });
    // If the deletion was successful, return a 200 success response.
    if (result.deletedCount > 0) {
        res.status(200).json({ status: 'success', message: 'Tasks deleted successfully.' });
    } else {
        // Otherwise, return a 404 not found error.
        res.status(404).json({ status: 'error', message: 'No tasks found for the provided IDs.' });
    }
})

/* -- Middleware to edit a given task -- */
app.post('/editTask', async (req, res) => {
    // User must be authenticated to edit tasks.
    if (!req.cookies.auth || req.cookies.auth !== 'true' || !req.cookies.email) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    // Get the task information from the request body.
    const { id, taskName, taskDescription, taskDueDate, taskPriority } = req.body;
    // All fields are required to edit a task, so if any are missing, return a 400 bad request error.
    if (!id || !taskName || !taskDescription || !taskDueDate || !taskPriority) {
        return res.status(400).json({ error: 'All fields are required.' });
    }
    // Edit the task in the database using the provided ID and email from the cookie.
    const result = await tasksCollection.updateOne(
        { _id: new ObjectId(id), email: req.cookies.email },
        { $set: { taskName, taskDescription, taskDueDate, taskPriority } }
    );
    // If the update was successful, return a 200 success response.
    if (result.modifiedCount === 1) res.json({ status: 'success', message: 'Task updated successfully.' });
    // Otherwise, return a 404 not found error.
    else res.status(404).json({ status: 'error', message: 'Task not found or not updated.' });
});

/* -- Middleware to update a task's completion status -- */
app.post('/complete', async (req, res) => {
    // User must be authenticated to update tasks.
    if (!req.cookies.auth || req.cookies.auth !== 'true' || !req.cookies.email) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    // Get the user's email from the cookie
    const email = req.cookies.email;
    // Get the task ID(s) and completion status from the request body.
    const { id, completed } = req.body;
    // If the ID is not provided, return a 400 bad request error.
    if (!id) return res.status(400).json({ error: 'Task ID is required.' });
    // Attempt to update the task's completion status to whatever is the opposite of it's current status in the database.
    await tasksCollection.updateOne(
        { _id: new ObjectId(id), email: email },
        { $set: { completed: !!completed } }
    );
    // If the task was updated successfully, return a 200 success response.
    res.status(200).json({ status: 'success', message: 'Task updated successfully.' });
})

// Start the server and inform the console of the port it is running on.
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});