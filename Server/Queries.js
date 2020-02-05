const Pool = require("pg").Pool;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: true
});

const getClinics = (request, response) => {
  pool.query('SELECT * FROM  "Clinic"', (error, results) => {
    if (error) {
      throw error;
    }
    response.status(200).json(results.rows);
  });
};

const authenticate = (request, response) => {
  const { username, password } = request.body;
  pool.query(
    'SELECT "userID", "UserType" FROM "User" WHERE "Username" = $1 AND "Password" = MD5($2);',
    [username, password],
    (error, results) => {
      if (error) {
        throw error;
      }
      response.status(200).json(results.rows);
    }
  );
};

const getClientDetails = (request, response) => {
  const userID = parseInt(request.params.id);
  pool.query(
    'SELECT * FROM  "Client" WHERE "userID" = $1',
    [userID],
    (error, results) => {
      if (error) {
        throw error;
      }
      response.status(200).json(results.rows);
    }
  );
};

const getPhysioDetails = (request, response) => {
  const userID = parseInt(request.params.id);
  pool.query(
    'SELECT "Physiotherapist"."Forename", "Physiotherapist"."Surname", "Clinic"."Name", "Physiotherapist"."physioID" \
	  FROM "Clinic" \
	  INNER JOIN "Physiotherapist" \
	  ON "Physiotherapist"."clinicID"= "Clinic"."clinicID" \
	  WHERE "Physiotherapist"."userID" = $1;',
    [userID],
    (error, results) => {
      if (error) {
        throw error;
      }
      response.status(200).json(results.rows);
    }
  );
};

const getPhysioClients = (request, response) => {
  const userID = parseInt(request.params.id);
  pool.query(
    'SELECT "Client"."clientID", "Client"."Forename", "Client"."Surname", "Client"."DoB", "Client"."roomID" \
	  FROM "Client" \
	  INNER JOIN "Physiotherapist" \
	  ON "Physiotherapist"."physioID"= "Client"."physioID" \
	  WHERE "Physiotherapist"."userID" = $1;',
    [userID],
    (error, results) => {
      if (error) {
        throw error;
      }
      response.status(200).json(results.rows);
    }
  );
};

module.exports = {
  authenticate,
  getClinics,
  getClientDetails,
  getPhysioDetails,
  getPhysioClients
};
