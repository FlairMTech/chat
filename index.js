const express = require("express");
const mysql = require("mysql2/promise");
const app = express();
const userRoutes = require("./routes/userRoutes");
const cors = require("cors");
require('dotenv').config();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());

app.use("/users", userRoutes);
app.get('/', (req, res) => {
  res.set('Content-Type', 'text/html; charset=ytf-8');
  res.send("<h1>Hello From Live</h1>");
})
let connection;

async function connect() {
  connection = await mysql.createConnection({
    host: process.env.HOST,
    user: process.env.USER,
    password:process.env.PASSWORD,
    database:process.env.DATABASE,
  });
  console.log("Connected to MySQL database.");
}

async function getLastMessagesFromRoom(room) {
  const [rows] = await connection.query(
    "SELECT * FROM messages WHERE `to_user` = ? OR `to_user` = REVERSE(?)",
    [room, room]
  );
  return rows.reverse();
}

const server = require("http").createServer(app);
const PORT = 5001;
const io = require("socket.io")(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  socket.on("new-user", async () => {
    const [rows] = await connection.query("SELECT * FROM students");
    io.emit("new-user", rows);
  });

  socket.on("join-room", async (newRoom, previousRoom) => {
    socket.join(newRoom);
    socket.leave(previousRoom);
    let roomMessages = await getLastMessagesFromRoom(newRoom);
    socket.emit("room-messages", roomMessages);
  });

  socket.on("message-room", async (room, content, sender, time, date) => {
    await connection.query(
      "INSERT INTO messages (`content`, `from_user`, `time`, `date`, `to_user`) VALUES (?, ?, ?, ?, ?)",
      [content, sender, time, date, room]
    );
    const [rows] = await connection.query(
      "SELECT * FROM messages WHERE `to_user` = ? OR `to_user` = REVERSE(?)",
      [room, room],
    );
    // socket.emit("room-messages", rows);
    // const userId = socket.id;
    // io.to(userId).emit("room-messages", rows.reverse());
    io.emit("room-messages", rows.reverse())
  });
   
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

connect().then(() => {
  server.listen(5000, (req, res) => {
   console.log("Server Started")
  });
});

module.exports = connection;
