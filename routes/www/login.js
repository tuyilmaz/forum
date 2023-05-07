const express = require('express');
const router = express.Router();

// 	/login

router.get('/', async (req, res, next) => {
	try {
		let pagedata = {
			powForum: req.powForum,
			accInfo: req.account,
		}
		
		//Return to home page if they're already logged in
		if(req.session.uid) return res.redirect('/')
		
		res.render('pages/login', pagedata)
	}
    catch(e){
        next(e)
    }
})

module.exports = router;