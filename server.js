
//Requiere the Modules


var express = require("express");
var method = require("method-override");
var body = require("body-parser");
var exphbs = require("express-handlebars");
var mongoose = require("mongoose");
var logger = require("morgan");
var cheerio = require("cheerio");
var request = require("request");
var axios = require("axios");

// Mongoose Section
 
var Note = require("./models/Note");
var Article = require("./models/Article");
var databaseUrl = 'mongodb://localhost/scrapedatabase';

if (process.env.MONGODB_URI) {
	mongoose.connect(process.env.MONGODB_URI);
}
else {
	mongoose.connect(databaseUrl);
};

mongoose.Promise = Promise;
var db = mongoose.connection;

db.on("error", function(error) {
	console.log("Mongoose Error: ", error);
});

db.once("open", function() {
	console.log("Mongoose connection successful.");
});


var app = express();
var port = process.env.PORT || 3000;

// APP SETUP

app.use(logger("dev"));
app.use(express.static("public"));
app.use(body.urlencoded({extended: false}));
app.use(method("_method"));
app.engine("handlebars", exphbs({defaultLayout: "main"}));
app.set("view engine", "handlebars");

app.listen(port, function() {
	console.log("Listening on port " + port);
})




//Using Axios to start scrape
app.get("/scrape", function(req, res) {
    
    
    axios.get("https://www.nytimes.com/section/world").then(function(response) {
     
      var $ = cheerio.load(response.data);
  
	
		var result = {};
		

		$("div.story-body").each(function(i, element) {
			var link = $(element).find("a").attr("href");
			var title = $(element).find("h2.headline").text().trim();
			var summary = $(element).find("p.summary").text().trim();
			var img = $(element).parent().find("figure.media").find("img").attr("src");
			result.link = link;
			result.title = title;
			if (summary) {
				result.summary = summary;
			};
			if (img) {
				result.img = img;
			}
			else {
				result.img = $(element).find(".wide-thumb").find("img").attr("src");
			};

		//The Article is saved in the variable entry.
		

			var entry = new Article(result);
			Article.find({title: result.title}, function(err, data) {
				console.log(data);


				//Verify if the Article exists.

				if (data.length === 0) {
					entry.save(function(err, data) {
						if (err) throw err;
					});
				}
			});
		});
		console.log("Scrape Done.");
		res.redirect("/");
	});
});




//Render to Index handlebar depends on if the Article already saved in the database

app.get("/", function(req, res) {
	Article.find({}, null, {sort: {created: -1}}, function(err, data) {
		if(data.length === 0) {
			res.render("index", {message: "There's nothing scraped yet. Pleas click \"Scrape\" to start."});
		}
		else{
			res.render("index", {articles: data});
		}
	});
});


//Based in the id change the status between "save article" and already "saved"

app.post("/save/:id", function(req, res) {
	Article.findById(req.params.id, function(err, data) {
		if (data.issaved) {
			Article.findByIdAndUpdate(req.params.id, {$set: {issaved: false, status: "Save Article"}}, {new: true}, function(err, data) {
				res.redirect("/");
			});
		}
		else {
			Article.findByIdAndUpdate(req.params.id, {$set: {issaved: true, status: "Saved"}}, {new: true}, function(err, data) {
				res.redirect("/saved");
			});
		}
	});
});


//Shows the saved notes

app.get("/saved", function(req, res) {
	Article.find({issaved: true}, null, {sort: {created: -1}}, function(err, data) {
		if(data.length === 0) {
			res.render("index", {message: "You have not saved any articles yet. Click \"Save Article\"!"});
		}
		else {
			res.render("saved", {saved: data});
		}
	});
});




//Find the notes related to the ARticle and render it
app.get("/notes/:id", function(req, res) {
	
	console.log(req.params.id);
	Article.find({ "_id": req.params.id })
	.populate("note")
	.exec(function(error, doc) {
	  // Logging any errors
	  if (error) {
		console.log(error);
	  }
	  else {
		var articleObj = {
		  article: doc
		};
		res.render("notes", articleObj);
	  }
	});
  });





	//Add a new note and relate it to the article

  app.post("/notes/:id", function(req, res) {
	
	
	console.log(req.body);
	var newNote = new Note(req.body);
	newNote.save(function(error, doc) {
	  if (error) {
		console.log(error);
	  }
	  else {
		Article.findOneAndUpdate({ "_id": req.params.id }, { $push: { "note": doc._id } }, { new: true }, function(err, doc) {
		  // Logging any errors
		  if (err) {
			console.log(err);
		  }
		  else {
			console.log("New note: " + doc);
		   res.redirect("/notes/" + req.params.id)
		  }
		});
	  }
	});
  });



	//Remove the note

  app.put("/note/:id", function(req, res) {
	
	Note.remove({ "_id": req.params.id })
	  .exec(function(err, doc) {
		if (err) {
		  console.log(err);
		}
		else {
		  console.log(doc);
		}
	  });
	res.redirect("/saved");
  });