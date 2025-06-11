## Magnolia

https://a3.greenbueller.com

Magnolia is the "premiere" task management tool, which allows users to add any task from their life, as well as the date/time it is due and the priority of it, and view it in relation to everything else they have to do. All aspects of the program are unique to the individual user logged in, and can only be accessed if logged in.

The login system makes use of a One-Time Password (OTP) system, where there are no passwords stored. **ever**. All that is required is an email, which you type in. Then, you will get an email from Magnolia with your OTP, which when entered correctly, will grant you access to Magnolia for one hour. If you do not already have an account, you will be asked to register by going to [the registration page](https://a3.greenbueller.com/register). Registration requires a display name (which is non-permanent) and an email only.

If you don't like your display name, you can modify it with the settings menu on the [home page](https://a3.greenbueller.com/home). This is the same page that allows users to add new tasks. Ready to view your tasks? Head over to the [task page](https://a3.greenbueller.com/tasks). Here, you can view all of your tasks. By clicking on the checkbox on the left side of a given task, an action menu will appear that allows you to edit, delete, and mark task(s) as completed.*

* You can only edit one task at a time, but completion and deletion can be done to multiple.

The biggest challenges I faced when making this was figuring out how to get the login system working. I have worked with sending emails before in webdev, so the OTP system was pretty straightforward. However, when it came to using cookies to let people in, and prevent non-logged in users from accessing the page, it was a bit of a challenge at first. I also had to redo how some of the systems I originally used worked in order to accomodate for this.

In this, I made use of two CSS frameworks, Picnic and Pure. I utilized Picnic for the OTP system, where it works as a card for where the user enters their email (and display name if registering), and as a modal for entering their OTP. Pure was utilized for the tasks page, where I made use of their buttons and tables to make the page a lot more visually contrasting in comparison to A2.

I made use of the following Express packages in this project:
- Path - Enables me to reference folders as paths, which makes the res.sendFile endpoints in the website display and routing section a lot easier to read.
- FS - FS is used to get the email template for the OTP from emailTemplate.html
- NodeMailer - NodeMailer is a package that allows for sending emails from your Node server via a provided email to any other email, assuming it's authenticated.
- Crypto - Crypto, while now deprecated, is a package I use to generate the OTP as a hex string
- Moment - Moment is used to set the expiration time of the OTP
- CookieParser - CookieParser is used to give, read, and delete cookies from the users browser
- MongoDB - Required for this project, and it allows for the storing of user account information as well as their associated tasks.
- Dotenv - Allows for usage of .env files, which allows for securing private information such as the Magnolia email's password and the MongoDB URI.


## Technical Achievements
- **Tech Achievement 1**: Use of .env file
The .env file, as briefly explained in the Dotenv package section above, made this project a lot better. My .env file is contained within my .gitignore file so it is only stored on my local machine that I develop on, which prevents anyone from finding tokens that could be used maliciously. For example, my MongoDB URI is stored in the .env file. If this URI file were to be publicly viewable (ie. hardcoded in the server.js file), anyone on the internet could then connect and read/delete/modify data on the database, which would obviously be an issue.
- **Tech Achievement 2**: Achieving 100% on all four lighthouse tests
- **Tech Achievement 3**: Using a platform other than Glitch
I am not sure if this fully counts as an achievement as I have been using Render for the duration of this class, but I have continued using it. It is my platform of choice for my website as well.

### Design/Evaluation Achievements
- **Design Achievement 1**: I followed the following tips from the W3C Web Accessibility Initiative...
