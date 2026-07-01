const dotenv = require('dotenv');
dotenv.config();

console.log("BAZIK_SECRET_KEY exists:", !!process.env.BAZIK_SECRET_KEY);
console.log("MONCASH_CLIENT_ID exists:", !!process.env.MONCASH_CLIENT_ID);
console.log("MONCASH_CLIENT_SECRET exists:", !!process.env.MONCASH_CLIENT_SECRET);
console.log("MONCASH_MODE:", process.env.MONCASH_MODE);
