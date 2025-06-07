const http = require( "http" ),
      fs   = require( "fs" ),
      // IMPORTANT: you must run `npm install` in the directory for this assignment
      // to install the mime library if you"re testing this on your local machine.
      // However, Glitch will install it automatically by looking in your package.json
      // file.
      mime = require( "mime" ),
      dir  = "public/",
      port = 3000

const appdata = []

const server = http.createServer( function( request,response ) {
  if( request.method === "GET" ) {
    handleGet( request, response )    
  }else if( request.method === "POST" ){
    handlePost( request, response ) 
  }
})

const handleGet = function( request, response ) {
  const filename = dir + request.url.slice( 1 ) 

  if( request.url === "/" ) {
    sendFile( response, "public/index.html" )
  } else if (request.url === "/tasks") {
    // Task Manager
    sendFile( response, "public/tasks.html" )
  } else if (request.url === "/entries") {
    // Endpoint to pull task list from appdata
    response.writeHead( 200, { "Content-Type": "application/json" })
    response.end(JSON.stringify(appdata))
  } else {
    const fileName = dir + request.url.slice( 1 );
    sendFile( response, fileName );
  }
};

const handlePost = function( request, response ) {
  let dataString = ""

  // Write all of the data to a temp variable
  request.on( "data", function( data ) {
      dataString += data 
  })

  // On finish writing data, handle the request
  request.on( "end", function() {
    // Log to console for debugging, not really needed.
    console.log( JSON.parse( dataString ) )

    // Handle new task being added from the front page
    if (request.url === "/submit") {
      const taskData = JSON.parse( dataString );
      // Used to identify the task
      taskData.id = appdata.length;
      // Used if the task is marked as completed and user wants to mark it as incomplete again.
      taskData.originalPriority = taskData.taskPriority;
      // This is the derived value, calculates the deadline based on the due date of the task. Largest unit is days, and smallest unit is seconds.
      taskData.taskDeadline = calculateDeadline(taskData);
      // Push the task to the appdata object
      appdata.push(taskData);

      // Return as a success
      response.writeHead( 200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ status: "success", entry: taskData }));
    } else if (request.url === "/complete") {
      // This endpoint is used when a task is marked as completed or uncompleted.
      const { id, completed } = JSON.parse(dataString);
      // Find the task in question based on its ID (as specified earlier)
      const task = appdata.find(task => task.id === id);
      // If the task was found
      if (task) {
        // Mark it as completed
        task.completed = completed;
        // If it is now completed, set the priority to "past"
        if (completed) {
          task.taskPriority = "past";
        } else {
          // Otherwise, reset to the original priority. If unknown, defaults to "Low".
          task.taskPriority = task.originalPriority || "Low";
        }
      }
      // Return as a success
      response.writeHead( 200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ status: "success" }));
    } else {
      // Error handling, should never happen.
      response.writeHead( 404, { "Content-Type": "text/plain" });
      response.end("404 Error: Endpoint Not Found");
      return;
    }
  })
}

// This function calculates the deadline based on the passed in task.
function calculateDeadline( data ) {
  // Gets the current date/time
  const today = new Date();
  // Gets the tasks due date from the passed in task
  const deadline = new Date(data.taskDueDate);
  // Calculate the difference between the two dates, as that is how deadlines work.
  const timeDiff = deadline - today;
  
  // Find the difference in days, hours, minutes, and seconds
  const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

  // Return the results as an object
  return { days, hours, minutes, seconds };
}

// This was unedited.
const sendFile = function( response, filename ) {
   const type = mime.getType( filename ) 

   fs.readFile( filename, function( err, content ) {

     // if the error = null, then we"ve loaded the file successfully
     if( err === null ) {

       // status code: https://httpstatuses.com
       response.writeHeader( 200, { "Content-Type": type })
       response.end( content )

     }else{

       // file not found, error code 404
       response.writeHeader( 404 )
       response.end( "404 Error: File Not Found" )

     }
   })
}

server.listen( process.env.PORT || port )
