import "dotenv/config";

async function testLogin() {
  console.log("Testing Login API locally...");
  
  // We need to start the server or hit it if it's running. 
  // But wait, we can just test the logic directly or hit http://localhost:3001/api/auth/login
  try {
    const res = await fetch("http://localhost:3001/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "01025754947", password: "admin123" })
    });
    
    const text = await res.text();
    console.log(`Status: ${res.status}`);
    console.log(`Response: ${text}`);
  } catch (err) {
    console.log("Server not running on port 3001, testing logic directly...");
    // Let's test the DB logic instead
    const pg = await import("pg");
    const bcrypt = await import("bcryptjs");
    const pool = new pg.default.Pool({ connectionString: process.env.DATABASE_URL });
    const dbRes = await pool.query("SELECT * FROM users WHERE phone = $1", ["01025754947"]);
    if (dbRes.rows.length === 0) {
      console.log("User not found in DB!");
    } else {
      const user = dbRes.rows[0];
      const match = await bcrypt.default.compare("admin123", user.password);
      console.log(`DB Password match: ${match}`);
      console.log(`User role: ${user.role}`);
    }
    pool.end();
  }
}

testLogin();
