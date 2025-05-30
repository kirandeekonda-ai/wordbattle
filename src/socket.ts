const ioClient = require("socket.io-client");
const URL = "https://wordbattle-n21r.onrender.com";
const socket = ioClient(URL, { autoConnect: true });
export default socket;