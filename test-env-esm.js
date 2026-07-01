import dotenv from 'dotenv';
dotenv.config();

console.log("=== Environment Variables Check ===");
console.log("BAZIK_SECRET_KEY length:", process.env.BAZIK_SECRET_KEY ? process.env.BAZIK_SECRET_KEY.length : 0);
console.log("BAZIK_SECRET_KEY prefix:", process.env.BAZIK_SECRET_KEY ? process.env.BAZIK_SECRET_KEY.slice(0, 5) : 'none');
console.log("BAZIK_USER_ID length:", process.env.BAZIK_USER_ID ? process.env.BAZIK_USER_ID.length : 0);
console.log("MONCASH_CLIENT_ID exists:", !!process.env.MONCASH_CLIENT_ID);
console.log("MONCASH_CLIENT_SECRET exists:", !!process.env.MONCASH_CLIENT_SECRET);
