// Initialize Firebase
var config = {
  apiKey: "AIzaSyAFPUH1hWWYpKipRvXS0F46expXRdBprYQ",
  authDomain: "birdie-855ac.firebaseapp.com",
  databaseURL: "https://birdie-855ac.firebaseio.com",
  storageBucket: "birdie-855ac.appspot.com",
};
firebase.initializeApp(config);

var firebaseDB = firebase.database();

var productsInFirebase = firebaseDB.ref('products');


// Set up auth:
var firebaseAuth = firebase.auth();
var provider = new firebase.auth.GoogleAuthProvider();

var token;
var currentUser;

var tags = [];
var probabilities = [];


$('#sign-in-button').on('click', function() {
  // Log in
  firebaseAuth.signInWithPopup(provider).then(function(result) {

    // This gives you a Google Access Token
    token = result.credential.idToken;
    console.log(result);

    // The signed-in user info.
    currentUser = result.user;
    console.log(currentUser);

    // display logged in user's image
    $('.profile-image').html('<img src="' + currentUser.photoURL + '" alt="" class="profile-image"/>');

    // Signed In: hide the sign in view and show the dashboard view
    $('.sign-in').hide();
    $('.dashboard').show();

  }).catch(function(error) {
    console.log(error);
  });


  // logout 
  $('#logout').on('click', function() {
    firebaseAuth.signOut().then(function () {
       console.log('logged out');
    }).catch(function (error) {
       console.log(error);
    });  
  })

})


// send the user's uploaded image url to the clarifai api, then pass the returned data to the parseResponse function
function postImage(imgurl) {
  var accessToken = 'Zw6KmHBwnG1QZMZ3evMvMbXg5hrZmJ';
  var data = {
    'url': imgurl
  };
  var url = 'https://api.clarifai.com/v1/tag';

  $.ajax({
      'url': url,
      'headers': {
          'Authorization': 'Bearer ' + accessToken
      },
      'data': data,
      'type': 'POST',
      success: function (response) {
          console.log("Response recevied from Clarifai");
          parseResponse(response);
      }
  });
}


// get the user's image url and pass it to the image detection function
$('#imgurl_submit').on('click', function() {
  var userImageUrl = $('#imgurl').val();
  postImage(userImageUrl);
})


// each image passed to the clarifai API returns a status code of 'OK' if it was successful
// if a successful status code, then save the tags & call showUploaded to display the user's uploaded image
function parseResponse(resp) {
  if (resp.status_code === 'OK') {
    var results = resp.results;
    console.log(results);
    tags = results[0].result.tag.classes;
    console.log(tags);
    // console.log("tags from upload: " + tags);
    probabilities = results[0].result.tag.probs;
    console.log(probabilities);

    showUploaded();

  } else {
    console.log('Sorry, something is wrong.');
  }

  // displays the user's uploaded image in a card
  function showUploaded() {
    var userImageUrl = $('#imgurl').val();
    $('#imgurl').val('');
    $('#uploaded-image-card').fadeIn();
    $('#uploaded-image-card').html('<h2>' + "You uploaded:" + '</h2>' + '<img src="' + userImageUrl + '" alt="" class="image-thumbnail"/>');    
    $('#dropdown').removeClass('hidden'); 
  }

  // Asynchronus callback to read new data in database
  productsInFirebase.on("value", function(snapshot) {
    iterate(snapshot.val());
    // addHelper(snapshot.val());
  }, function (errorObject) {
   console.log("The read failed: " + errorObject.code);
  });

  // compares the user's upload with products in the db
  function iterate(products) {

    var inCommon = [];
    var inCommonSorted;

    for (prop in products) {      
      // save the like tags 
      var tagsComparison = _.intersection(tags, products[prop].tags);

      var productsFirebase = products[prop];
      
      // save the products based on like tags (with a count of like tags) 
      inCommon.push({
        numTags: tagsComparison.length, 
        product: productsFirebase 
      }) 

      // sort the products based on the highest count of like tags
      inCommonSorted = _.sortBy(inCommon, 'numTags').reverse(); 
      // console.log(inCommonSorted);
    
    // if there are a small number of like tags, display error state (because the quality of the output would not be high enough)
    if (inCommonSorted[0].numTags < 7 || inCommonSorted[0] === 'undefined' || inCommonSorted[0] === 'null') {
      $('.flex-container').removeClass('hidden');
      $('.uploaded-flex-item').removeClass('hidden');
      $('#product-match-card').fadeIn();
      $('#product-match-card').html("Yikes! We could not find a match.");
      $('#dropdown').removeClass('hidden'); 
      inCommon = [];
      inCommonSorted = [];
    }

    // displays the best match (product with the highest number of like tags)
    else {
      $('.flex-container').removeClass('hidden');
      $('.uploaded-flex-item').removeClass('hidden');
      $('#product-match-card').fadeIn();       
      $('#product-match-card').html('<h2>' + "Try this: "  + '</h2>' + '<img src="' + inCommonSorted[0].product.itemImage + '" alt="" class="image-thumbnail"/>' + inCommonSorted[0].product.itemName + "<br>" + '<a href="' + inCommonSorted[0].product.url + '"class="popUpAction" target="_blank">' + "View Details" + '</a>');              
    }
  }  


  // enables the user to choose a helper to improve the product match result
  $(document).on('change', '#dropdown', function(e) {
    
    var x = userSelectedHelperTag;

    // saves the users selection from the helper drop down
    var userSelectedHelperTag = this.options[e.target.selectedIndex].text;
    console.log(userSelectedHelperTag);

    for (prop in products) {

      var productsHelperFirebase = [];
      var helperInCommon = [];

      if (userSelectedHelperTag === products[prop].helperTag) {
        
        // add products matching the user's helper to a new array
        productsHelperFirebase.push(products[prop]);
        console.log(products[prop]);

        // compares the tags of the user's upload against the tags of products matching the user's selected helper
        for (var i = 0; i < productsHelperFirebase.length; i++) {
          var tagsHelperComparison = _.intersection(tags, productsHelperFirebase[i].tags);
          // console.log(tagsHelperComparison.length)

          helperInCommon.push({
            numTags: tagsHelperComparison.length, 
            product: productsHelperFirebase[i] 
          }) 
        } 


        // sort the products based on the highest count of like tags considering only products that match the user's selected helper
        var helperInCommonSorted = _.sortBy(helperInCommon, 'numTags').reverse();
        console.log(helperInCommonSorted) 


        // if there are a small number of like tags considering only products that match the user's selected helper, display error state (because the quality of the output would not be high enough)
        if (helperInCommonSorted[0].numTags < 7 || helperInCommonSorted[0] === 'undefined' || helperInCommonSorted[0] === 'null') {
          $('.flex-container').removeClass('hidden');
          $('.uploaded-flex-item').removeClass('hidden');
          $('#product-match-card').fadeIn();
          $('#product-match-card').html("Yikes! We could not find a match.");
          $('#dropdown').removeClass('hidden');  
        }

        // displays the best match (product with the highest number of like tags considering only products that match the user's selected helper)
        else {
          $('.flex-container').removeClass('hidden');
          $('.uploaded-flex-item').removeClass('hidden');
          $('#product-match-card').fadeIn();       
          $('#product-match-card').html('<h2>' + "Try this: "  + '</h2>' + '<img src="' + helperInCommonSorted[0].product.itemImage + '" alt="" class="image-thumbnail"/>' + helperInCommonSorted[0].product.itemName + "<br>" + '<a href="' + helperInCommonSorted[0].product.url + '"class="popUpAction" target="_blank">' + "View Details" + '</a>');              
        }
      }
    } 
  })
  }
}   