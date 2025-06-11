Acheivements
---

Below are suggested technical and design achievements. You can use these to help boost your grade up to an A and customize the 
assignment to your personal interests, for a maximum twenty additional points and a maximum grade of a 100%. 
These are recommended acheivements, but feel free to create/implement your own... just make sure you thoroughly describe what you did in your README, 
why it was challenging, and how many points you think the achievement should be worth. 
ALL ACHIEVEMENTS MUST BE DESCRIBED IN YOUR README IN ORDER TO GET CREDIT FOR THEM.

*Technical*
- (10 points) Implement OAuth authentication, perhaps with a library like [passport.js](http://www.passportjs.org/). 
*You must either use Github authenticaion or provide a username/password to access a dummy account*. 
Course staff cannot be expected, for example, to have a personal Facebook, Google, or Twitter account to use when grading this assignment. 
Please contact the course staff if you have any questions about this. THIS IS THE HARDEST ACHEIVEMENT OFFERED IN WEBWARE. You have been warned!  
- (5 points) Instead of Glitch, host your site on a different service. Find a service that is reputable and has a free tier. Post your findings on Slack in the #assignment3 channel. DO NOT feel compelled to purchase a paid tier from any service, although if you already have one, you are welcome to use it. Make sure to describe this a bit in your README. What was better about using the service you chose as compared to Glitch? What (if anything) was worse? 
- (5 points) Get 100% (not 98%, not 99%, but 100%) in all four lighthouse tests required for this assignment.  

*Design/UX*
- (10 points) Make your site accessible using the [resources and hints available from the W3C](https://www.w3.org/WAI/), Implement/follow twelve tips from their [tips for writing](https://www.w3.org/WAI/tips/writing/), [tips for designing](https://www.w3.org/WAI/tips/designing/), and [tips for development](https://www.w3.org/WAI/tips/developing/). *Note that all twelve must require active work on your part*. 
For example, even though your page will most likely not have a captcha, you don't get this as one of your twelve tips to follow because you're effectively 
getting it "for free" without having to actively change anything about your site. 
Contact the course staff if you have any questions about what qualifies and doesn't qualify in this regard. 
List each tip that you followed and describe what you did to follow it in your site.
- (5 points) Describe how your site uses the CRAP principles in the Non-Designer's Design Book readings. 
Which element received the most emphasis (contrast) on each page? 
How did you use proximity to organize the visual information on your page? 
What design elements (colors, fonts, layouts, etc.) did you use repeatedly throughout your site? 
How did you use alignment to organize information and/or increase contrast for particular elements. 
Write a paragraph of at least 125 words *for each of four principles* (four paragraphs, 500 words in total). 



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
- **Tech Achievement 2**: 

### Design/Evaluation Achievements
- **Design Achievement 1**: I followed the following tips from the W3C Web Accessibility Initiative...
