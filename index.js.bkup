const express = require("express");
const mysql = require('mysql');
const sha = require('sha.js');
const app = express();
const pool = dbConnection();
const session = require('express-session');

app.set("view engine", "ejs");
app.use(express.static("public"));

app.set('trust proxy', 1); // trust first proxy
app.use(session({
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, //SET TO TRUE IN REPLIT
    maxAge: 1000 * 60 * 60 * 24, // one day
  }
}));

//to parse Form data sent using POST method
app.use(express.urlencoded({ extended: true }));

app.use(express.json());


/////////////
// GLOBALS //
/////////////

const spoonacularApiKey = "6cd91bd2957542d8a793c4720e1557cc";
//other keys: a61dfb2a19434898910488d7bd20dd1e, b4314670500c42ecaba9609158ae2ad8
let krogerToken;


//////////////////
// API REQUESTS //
//////////////////

// Kroger API

// Get tokens
const getToken = async () => {
  console.log("getting new token");
  const authString = "d2hhdHRvZWF0LTcwZGVmYzNmNmQ4MWJlYjYzMWYwMTkxMDBkYTk5OGIwODg2NjkxNzA2MTA2OTY1ODcyMjp1WDZCSk9iZnBybHRjb1duaktMdEtTOGNmdGFHek9SWlNnQmlQbDRt";

  const settings = {
    "method": "POST",
    "headers": {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": "Basic " + authString
    },
    "body": "grant_type=client_credentials&scope=product.compact"
  };

  response = await fetch("https://api-ce.kroger.com/v1/connect/oauth2/token", settings);
  const json = await response.json();
  krogerToken = json.access_token;
}

// Generic Kroger GET
const getRequest = async (url) => {
  const settings = {
    "method": "GET",
    "headers": {
      "Accept": "application/json",
      "Authorization": `Bearer ${krogerToken}`
    }
  }

  const response = await fetch(url, settings);
  const json = await response.json();

  if (json.error == "API-401: Invalid Access Token") {
    await getToken();
    return await getRequest(url);
  } else {
    return json;
  }
}

// Get locations using a zipcode, radius, and chain (store)
const getLocations = async (zipCode, radius, chain) => {
  let url = `https://api-ce.kroger.com/v1/locations?filter.zipCode.near=${zipCode}&filter.radiusInMiles=${radius}`;
  if (chain != "all") {
    url += `&filter.chain=${chain}`;
  }
  return await getRequest(url);
}

// Get names of all chains
const getChains = async () => { return await getRequest("https://api-ce.kroger.com/v1/chains"); }

// Get products
const getProducts = async (name, locationId, start = 1) => {
  return await getRequest(`https://api-ce.kroger.com/v1/products?filter.locationId=${locationId}&filter.term=${name}&filter.limit=50&filter.start=${start}`);
}

// Spoonscular API

// Get recipe data based on user's ingredients
const getRecipes = async (userId, pantry) => {
  rows = await executeSQL(`SELECT ingredient
                           FROM ingredients
                           WHERE userId = ?`,
    [userId]);
  let ingredientList = "";

  rows.forEach(ingredient => {
    ingredientList += `${ingredient.ingredient},`
  })
  ingredientList = ingredientList.slice(0, -1);

  const response = await fetch(`https://api.spoonacular.com/recipes/findByIngredients?apiKey=${spoonacularApiKey}&number=3&ranking=1&ingredients=${ingredientList}&ignorePantry=${pantry}`);
  const json = await response.json();
  return json;
}

const getRandomRecipe = async () => {
  const response = await fetch(`https://api.spoonacular.com/recipes/random?apiKey=${spoonacularApiKey}&number=2`);
  const json = await response.json();
  return json;
}

// Resolve the common name of items based on their product name
const resolveName = async (product) => {
  const settings = {
    "method": "POST",
    "headers": {
      "Content-Type": "application/json"
    },
    "body": `{"title":${product}}`
  };
  response = await fetch(`https://api.spoonacular.com/food/products/classify?apiKey=${spoonacularApiKey}`, settings);
  json = await response.json();
  return json.matched;
}

///////////
// VIEWS //
///////////

// Login page
app.get('/', (req, res) => {
  res.render('login');
});

app.get('/home', auth, async (req, res) => {
  const recipe = await getRandomRecipe();
  res.render('home', {
    "title": recipe.recipes[0].title,
    "image": recipe.recipes[0].image,
    "url": recipe.recipes[0].sourceUrl,
    "summary": recipe.recipes[0].summary,
    "title2": recipe.recipes[1].title,
    "image2": recipe.recipes[1].image,
    "url2": recipe.recipes[1].sourceUrl,
    "summary2": recipe.recipes[1].summary,
    "locationName":req.session.locationName
  });
});

// Account creation page
app.get('/login/create', (req, res) => {
  res.render('createAccount');
});

// Recipe display page
app.get('/recipes', auth, async (req, res) => {
  const recipes = await getRecipes(req.session.userId, req.session.pantry);
  req.session.recipes = recipes;

  // Split recipe aisle categor(ies) into an array
  let ingredients = [];
  recipes.forEach(recipe => {
    recipe.missedIngredients.forEach(ingredient => {
      splitAisles = ingredient.aisle.split(";");
      ingredients.push([ingredient.name, splitAisles]);
    });
  });

  // Gather every product from Kroger API for the ingredient
  for (let i = 0; i < ingredients.length; i++) {
    if (!(ingredients[i][0] in req.session.productData)) {
      console.log(`Getting product data for ${ingredients[i][0]}...`);
      const storeProducts = await getIngredientPrice(ingredients[i][0], req.session.locationId, ingredients[i][1]);
      req.session.productData[ingredients[i][0]] = {
        "use": 0,
        "products": storeProducts
      };
    }
  }

  res.render('recipes', {
    "recipes": recipes,
    "products": req.session.productData
  });
});

app.get('/recipes/saved', auth, async (req, res) => {
  rows = await executeSQL(`SELECT name, image, likes
                           FROM recipes
                           WHERE userId = ?`,
                           [req.session.userId]);
  res.render('savedRecipes', {"recipes":rows});
});

// Page to search for, display, and set locations
app.get('/location/search', auth, async (req, res) => {
  if (req.session.chains == undefined) {
    const chains = await getChains();
    req.session.chains = chains.data;
  }
  res.render('location', { "chains": req.session.chains });
});

// Page for entering ingredients
app.get('/ingredients', auth, async (req, res) => {
  rows = await executeSQL(`SELECT ingredient
                           FROM ingredients
                           WHERE userId = ?`,
    [req.session.userId]);
  req.session.ingredients = rows;
  res.render('ingredients', { "ingredients": req.session.ingredients });
});

// select an ingredient from the list shown
app.post('/ingredient/select', auth, async (req, res) => {
  console.log("use: " + req.body.id);
  console.log("ingredient " + req.body.name);
  req.session.productData[req.body.name].use = parseInt(req.body.id);
  res.render('recipes', {
    "recipes": req.session.recipes,
    "products": req.session.productData
  });
});

// Page for selecting the correct ingredient on the recipe page
app.post('/ingredient/selector', auth, async (req, res) => {
  res.render('ingredientSelector', {
    "name": req.body.name,
    "products": req.body.productList
  });
});

/////////////
// ACTIONS //
/////////////

// Retrive locations
app.post('/location/results', auth, async (req, res) => {
  let locationResults = await getLocations(req.body.zip, req.body.radius, req.body.chain);
  res.render('location', {
    "locations": locationResults.data,
    "chains": req.session.chains
  });
});

// Authenticate user
app.post('/login', async (req, res) => {
  const sql = `SELECT userId
               FROM accounts
               WHERE username = ? AND password = ?`;
  const sha256 = sha('sha256');
  const hashPass = sha256.update(req.body.password, 'utf8').digest('hex');
  const params = [req.body.username, hashPass];
  const rows = await executeSQL(sql, params);
  if (rows[0] == undefined) {
    console.log("login failed");
  } else {
    console.log("login success");
    req.session.userId = rows[0].userId;
    req.session.locationId = 70400534; // REMOVE WHEN TURING IN
    req.session.pantry = false;
    req.session.productData = {};
    req.session.locationName = "None";
    res.redirect('/home');
  }
});

// Logout user and clear session
app.get('/logout', async (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Add new username and password to the database
app.post('/createAccount', async (req, res) => {
  if (req.body.password == req.body.confirm) {
    const sql = `INSERT INTO accounts
                 (username, password)
                 VALUES (?, ?)`;
    const sha256 = sha('sha256');
    const hashPass = sha256.update(req.body.password, 'utf8').digest('hex');
    const params = [req.body.username, hashPass];
    const rows = await executeSQL(sql, params);
    res.redirect('/');
  } else {
    console.log("passwords do not match");
    res.redirect('/login/create');
  }
});

// Add an ingredient to the database
app.post('/ingredient/add', auth, async (req, res) => {
  const sql = `INSERT INTO ingredients (ingredient, userId)
               SELECT ?, ?
               WHERE NOT EXISTS (
               SELECT * FROM ingredients
               WHERE ingredient = ? AND userId = ?
               )`;
  const params = [req.body.ingredient, req.session.userId, req.body.ingredient, req.session.userId];
  const rows = await executeSQL(sql, params);
  const success = rows.affectedRows;
  res.send({ success: success });
});

// Remove an ingredient from the database
app.post('/ingredient/remove', auth, async (req, res) => {
  const sql = `DELETE FROM ingredients 
               WHERE userId = ? AND ingredient = ?`;
  const params = [req.session.userId, req.body.ingredient];
  const rows = await executeSQL(sql, params);
  const success = rows.affectedRows;
  res.send({ success: success });
});

// Set user's store location
app.get('/setLocation', auth, (req, res) => {
  req.session.locationId = req.query.id;
  req.session.locationName = req.query.name;
  console.log("locationId: " + req.session.locationId);
  console.log("location name" + req.query.name);
  res.redirect('/home');
});

app.post('/saveRecipe', auth, async (req, res) => {
  
  const sql = `INSERT INTO recipes (name, image, likes, userId)
               VALUES (?, ?, ?, ?)`;
  const params = [req.body.recipeName, req.body.image, parseInt(req.body.likes), req.session.userId];
  console.log("name: " + req.body.name);
  console.log("image: " + req.body.image);
  console.log("likes: " + req.body.likes);
  console.log("user: " + req.session.userId);
  
  await executeSQL(sql, params);
  res.redirect('/recipes');
});

// Set whether pantry items should be included or not
app.post('/pantry', auth, (req, res) => {
  req.session.pantry = req.body.pantry;
  res.send();
});

// Get pantry checkbox status
app.get('/pantry', auth, (req, res) => {
  res.send({ "checked": req.session.pantry });
});

//functions
async function getIngredientPrice(ingredient, locationId, aisles) {
  let allProducts = [], applicableProducts;
  let response;
  let start = -49;

  // Spoonacular ingredient aisle : Kroger product categories
  let categorySet = {
    "Baking": ["Baking Goods"],
    "Health Foods": [],
    "Spices and Seasonings": ["Baking Goods"],
    "Pasta and Rice": ["Pasta, Sauces, Grain"],
    "Bakery/Bread": ["Bakery"],
    "Refrigerated": ["Snacks"],
    "Canned and Jarred": ["Canned & Packaged"],
    "Frozen": ["Frozen"],
    "Nut butters, Jams, and Honey": ["Condiment & Sauces"],
    "Oil, Vinegar, Salad Dressing": ["Baking Goods", "Condiment & Sauces"],
    "Condiments": ["Condiment & Sauces"],
    "Savory Snacks": ["Snacks"],
    "Milk, Eggs, Other Dairy": ["Dairy"],
    "Ethnic Foods": ["International"],
    "Tea and Coffee": ["Natural & Organic", "Beverages"],
    "Meat": ["Deli", "Meat & Seafood"],
    "Gourmet": [],
    "Sweet Snacks": ["Candy"],
    "Gluten Free": [],
    "Alcoholic Beverages": ["Adult Beverage"],
    "Cereal": ["Breakfast"],
    "Nuts": ["Snacks"],
    "Beverages": ["Beverages"],
    "Produce": ["Produce", "Baking Goods", "Natural & Organic"], // ADDED BAKING GOODS FOR CILANTRO, NATURAL/ORGANIC FOR CARROTS REMOVE IF PROBLEMS
    "Not in Grocery Store/Homemade": [""],
    "Seafood": ["Meat & Seafood"],
    "Cheese": ["Dairy"],
    "Online": [],
    "Grilling Supplies": [],
    "Dried Fruits": ["Snacks"],
    "Bread": ["Bakery"]
  }

  // Collect products from API
  let retry = false;
  while (start < 250) {
    start < 201 ? start += 50 : start = 250;
    response = await getProducts(ingredient, locationId, start);
    try {
      response.data.forEach(product => {
        allProducts.push(product);
      });
    } catch {
      console.log("\n\n\n\n\n\n");
      console.log(JSON.stringify(response));
      console.log("\n\n\n\n\n\n");
    }


    // stop searching once there are no more pages of products
    try {
      console.log(`${start + 50 > response.meta.pagination.total ? response.meta.pagination.total : start + 50}/${response.meta.pagination.total}`);
      if (start + 50 >= response.meta.pagination.total) {
        break;
      }
      // If no results are found, convert the name to its generic name and try one more time
    } catch {
      if (retry) {
        console.log("Could not find ingredient after a retry")
        break;
      }
      retry = true;
      start = -49;
      ingredient = await resolveName([ingredient]);
      console.log("No results... Searching for " + ingredient + " insead");
    }
  }

  // Filter out items from the wrong category
  applicableProducts = allProducts.filter(product => {
    return aisles.some(aisle => {
      return categorySet[aisle].some(category => {
        return product.categories.includes(category);
      });
    });
  });
  
  // Filter out items that don't have price data
  applicableProducts = applicableProducts.filter(product => {
    if (product.items[0].price) {
      return true;
    } else {
      return false;
    }
  });

  // Sort the items by cheapest
  applicableProducts.sort((a, b) => a.items[0].price.regular - b.items[0].price.regular);

  // Create JSON object
  let productData = [];
  applicableProducts.forEach(product => {
    // Grab an image for the product
    let image = ""
    for (let i = 0; i < product.images.length; i++) {
      try {
        image = product.images[i].sizes[0].url;
        break;
      } catch {
        continue;
      }
    }
    productData.push({
      "name": product.description,
      "amount": product.items[0].size,
      "price": parseFloat(product.items[0].price.regular.toFixed(2)),
      "image": image
    })
  });
  return (productData);
}

function auth(req, res, next) {
  req.session.userId == null ? res.redirect('/') : next();
}

async function executeSQL(sql, params) {
  return new Promise(function(resolve, reject) {
    pool.query(sql, params, function(err, rows, fields) {
      if (err) throw err;
      resolve(rows);
    });
  });
}

function dbConnection() {
  const pool = mysql.createPool({
    connectTimeout: 60 * 60 * 1000,
    acquireTimeout: 60 * 60 * 1000,
    connectionLimit: 10,
    host: "eyvqcfxf5reja3nv.cbetxkdyhwsb.us-east-1.rds.amazonaws.com",
    user: "b1jece9nmuw0lowf",
    password: "rn6cwuudehgsjr9a",
    database: "zjc0cza164eelrk9"

  });
  return pool;
}

//start server
app.listen(3000, () => {
  console.log("Expresss server running...")
});