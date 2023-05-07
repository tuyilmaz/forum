const router = require('express').Router()
var escape = require('escape-html')
const bodyParser = require('body-parser')
const crypto = require('crypto')
const mongoose = require("mongoose")
const phraseblacklist = require('phrase-blacklist')
const bcrypt = require('bcrypt')
const md5 = require('md5')
const fetch = require('node-fetch')

const other = require('../../../my_modules/other')
const recaptcha = require('../../../my_modules/captcha')
const { isMajorEmailDomain, SendBasicEmail } = require('../../../my_modules/email')
const accountAPI = require('../../../my_modules/accountapi')
const pfAPI = require('../../../my_modules/pfapi')

const ForumSettings = mongoose.model("ForumSettings")
const Accounts = mongoose.model("Accounts")

// parse application/json
router.use(bodyParser.urlencoded({ extended: true }));
router.use(bodyParser.json({limit: '5mb'}))

// 	/api/account/register
router.options('/')
router.post('/', async (req, res, next) => {
	try {
		let response = {success: false}

		//Check if user is already logged in.
		if(req.session.uid) throw "Can't create account while logged in"
		
		//Must complete google captcha first
		let ip = (req.headers['x-forwarded-for'] || req.connection.remoteAddress)
		if(!await recaptcha.captcha(req.body['g-recaptcha-response'], ip)) 
			throw "Captcha failed"

		let { username, email, password } = req.body

		//Limit accounts per IP
		if(await pfAPI.CountAccountsOnIp(ip) >= 3) throw "Unwanted activity detected"
	
		//Validate username
		if(!username) throw "Missing username"
		if(!(username.length >= 3 && username.length <= 15)) throw "Username must be 3-15 characters in length"
		
		//No need to escape username because of alphanumeric_ limit
		if(!other.isAlphaNumeric_(username)) throw "Only letters, numbers, and underscore are allowed"

		let isClean = phraseblacklist.isClean(username.toLowerCase())
		if (typeof isClean === "string") throw `Your username contains a banned phrase: ${isClean}`
		
		let existingAccount = await accountAPI.fetchAccount(username)
		if(existingAccount) throw "Username is taken"
		
		//Validate & sanitze email
		if(!email) throw "Missing email"
		email = email.toLowerCase()
		if(!other.ValidateEmail(email)) throw "Invalid email"
		email = escape(email)
		if(!isMajorEmailDomain(email)) throw "We only allow email addresses from major email providers, such as Gmail."
		if(await accountAPI.emailTaken(email)) throw "An account already exists with this email" 

		//Uses gravatar for pfp if one exists for their email
		let toAttach = {}
		let hashedEmail = md5(email)
		await fetch(`https://en.gravatar.com/${hashedEmail}.json`)
		.then(res => res.json())
		.then(res => {
			if(res !== "User not found") {
				toAttach.profilepicture = "https://www.gravatar.com/avatar/" + hashedEmail
			}
		})

		if(!password) throw "Missing password"
		let validatedPassword = accountAPI.ValidatePassword(password)
		if(validatedPassword !== true) throw validatedPassword
		
		//No need to sanitize password. It can be what ever they want!
		//No need to escape since their password wouldn't be displayed as html anywhere. It may also interfere with authentication
		password = await bcrypt.hash(password, 10)

		//Creates verification session
		let hash = crypto.randomBytes(64).toString('hex');
		let emailVerification = {
			token: hash,
			lastSent: new Date()
		}
		
		//No exit, so create account because sanitization passed
		let newAccount = await new Accounts({
			email, 
			username, 
			password, 
			emailVerification, 
			...toAttach
		})
		.save()

		req.session.uid = newAccount._id

		//Send email verification request via email
		var emailBody = 'Hello,\n\n' +
		`Someone has signed up for the account, ${username}(ID:${req.session.uid}) at ${process.env.FORUM_URL} using your email. To verify this address, please visit the link below. In doing so, you remove restriction from services such as posting to the forum and enable higher account security.\n\n` +
		`${process.env.FORUM_URL}/verify?token=${hash}\n\n` + 
		`This message was generated by ${process.env.FORUM_URL}.`
		
		SendBasicEmail(email, `${(await ForumSettings.findOne({type: "title"})).value} | Email Verification`, emailBody)
		.catch(err=>{
			//Handle the error, but allow account to remain created successfully
			console.error(`Issue when sending the email verification at register for @${req.session.uid} ${email}: `, err)
		})

		//Report successful account creation
		response.success = true
		res.json(response)

		//Logs their login event
		await pfAPI.TrackLogin(newAccount._id, (req.headers['x-forwarded-for'] || req.connection.remoteAddress))
	}
	catch(e){
		next(e)
	}
})

module.exports = router;