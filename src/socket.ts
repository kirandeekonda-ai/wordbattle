const ioClient = require("socket.io-client");
const URL = "http://localhost:4000";
const socket = ioClient(URL, { autoConnect: true });
export default socket;