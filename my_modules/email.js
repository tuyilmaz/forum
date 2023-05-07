module.exports = {
	//Wraps mailgun sender into promise
	SendMail: (emaildata) => {
		const nodemailer = require('nodemailer');
		
		
		let mailTransporter = nodemailer.createTransport({
			service: 'gmail',
			auth: {
				user: 'tuyilmazforum@gmail.com',
				pass: 'Utkuyilmaz1605.dll'
			}
		});
		
		return new Promise( ( resolve, reject ) => {
			mailTransporter.sendMail(mailDetails, function(err, data) {
				if(err) {
					console.log('Error Occurs');
				} else {
					console.log('Email sent successfully');
				}
			});
		})
		.catch(e => {console.log("Failed to send email1: ", e)})
	},

	//Just the bare minimum to sending an email
	SendBasicEmail: (to, subject, body) => {
		let emaildata = {
			from: `tuyilmazforum@gmail.com`,
			to: to,
			subject: subject,
			text: body
		};

		return module.exports.SendMail(emaildata)
	},

	isMajorEmailDomain: (emailAddress) => {
		const whitelist = ["gmail.com", "aol.com", "outlook.com", "yahoo.com", "icloud.com", "mozilla.com", 
		"protonmail.com", "proton.me", "hotmail.com", "zoho.com", "live.com", "comcast.net"]

		//Grabs the domain part of an email address. (eg. mail@domain.com = domain.com)
		var ind = emailAddress.indexOf("@");
		var sliced = emailAddress.slice((ind+1),emailAddress.length);

		//Checks if the domain is whitelisted
		return whitelist.includes(sliced)
	}
}