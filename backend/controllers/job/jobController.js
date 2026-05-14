const pool = require("../../db/db");


// CREATE JOB
exports.createJob = async (req, res) => {
  try {
    const { type ,title ,phone ,description , company , location , email ,  } = req.body;
    const result = await pool.query(
      "INSERT INTO jobs (type, title, phone, description, company, location, email) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
      [type, title, phone, description, company, location, email]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating job:", error);
    res.status(500).json({ error: "Failed to create job" });
  }
};

// GET ALL JOBS
exports.getJobs = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        jobs.*,

        CASE
          WHEN workers.job_id IS NOT NULL THEN true
          ELSE false
        END AS applied

      FROM jobs

      LEFT JOIN workers
      ON jobs.id = workers.job_id

      ORDER BY jobs.id DESC
    `);

    res.status(200).json(result.rows);

  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: "Failed to fetch jobs",
    });
  }
};

// GET JOB BY ID
exports.getJobById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("SELECT * FROM jobs WHERE id = $1", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Job not found" });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching job:", error);
    res.status(500).json({ error: "Failed to fetch job" });
  }
};

// DELETE JOB
exports.deleteJob = async (req, res) => {
  try {    const { id } = req.params;
    const result = await pool.query("DELETE FROM jobs WHERE id = $1 RETURNING *", [id]);    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Job not found" });
    }   res.status(200).json({ message: "Job deleted successfully" });
    } catch (error) {
    console.error("Error deleting job:", error);
    res.status(500).json({ error: "Failed to delete job" });
  }
};

// UPDATE JOB
exports.updateJob = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, title, phone, description, company, location, email } = req.body;
    const result = await pool.query(
      "UPDATE jobs SET type = $1, title = $2, phone = $3, description = $4, company = $5, location = $6, email = $7 WHERE id = $8 RETURNING *",
      [type, title, phone, description, company, location, email, id]
    );
    if (result.rows.length === 0) {
        return res.status(404).json({ error: "Job not found" });
    }
    res.status(200).json(result.rows[0]);
  }
    catch (error) {
    console.error("Error updating job:", error);
    res.status(500).json({ error: "Failed to update job" });
  }
};

 // SEARCH JOBS
exports.searchJobs = async (req, res) => {
  try {
    const { query } = req.query;
    const result = await pool.query(
      "SELECT * FROM jobs WHERE title ILIKE $1 OR description ILIKE $1 OR company ILIKE $1 OR location ILIKE $1",
        [`%${query}%`]
    );
    res.status(200).json(result.rows);
  }
    catch (error) {
    console.error("Error searching jobs:", error);
    res.status(500).json({ error: "Failed to search jobs" });
  }
};

// FILTER JOBS
exports.filterJobs = async (req, res) => {
  try {
    const { type } = req.query;
    const result = await pool.query(
      "SELECT * FROM jobs WHERE type = $1",
        [type]
    );
    res.status(200).json(result.rows);
  }
    catch (error) {
    console.error("Error filtering jobs:", error);
    res.status(500).json({ error: "Failed to filter jobs" });
  }
};

// SORT JOBS
exports.sortJobs = async (req, res) => {
  try {    const { sortBy } = req.query;
    const result = await pool.query(
      `SELECT * FROM jobs ORDER BY ${sortBy} ASC`
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error sorting jobs:", error);
    res.status(500).json({ error: "Failed to sort jobs" });
  } };  

  // PAGINATE JOBS
exports.paginateJobs = async (req, res) => {
  try {    const { page, limit } = req.query;
    const offset = (page - 1) * limit;
    const result = await pool.query(
        "SELECT * FROM jobs LIMIT $1 OFFSET $2",
        [limit, offset]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error paginating jobs:", error);
    res.status(500).json({ error: "Failed to paginate jobs" });
  }
};

// GET JOBS BY COMPANY
exports.getJobsByCompany = async (req, res) => {
  try {    const { company } = req.params;
    const result = await pool.query(
        "SELECT * FROM jobs WHERE company = $1",
        [company]
    );
    res.status(200).json(result.rows);
  }
    catch (error) {
    console.error("Error fetching jobs by company:", error);
    res.status(500).json({ error: "Failed to fetch jobs by company" });
  }
};

// GET JOBS BY LOCATION
exports.getJobsByLocation = async (req, res) => {
  try {    const { location } = req.params;
    const result = await pool.query(
        "SELECT * FROM jobs WHERE location = $1",
        [location]
    );
    res.status(200).json(result.rows);
  } 
    catch (error) {
    console.error("Error fetching jobs by location:", error);
    res.status(500).json({ error: "Failed to fetch jobs by location" });
  }
};

// GET JOBS BY TYPE
exports.getJobsByType = async (req, res) => {
  try {    const { type } = req.params;
    const result = await pool.query(
        "SELECT * FROM jobs WHERE type = $1",
        [type]
    );
    res.status(200).json(result.rows);
  }
    catch (error) {
    console.error("Error fetching jobs by type:", error);
    res.status(500).json({ error: "Failed to fetch jobs by type" });
  }
};

// GET JOBS BY TITLE
exports.getJobsByTitle = async (req, res) => {
  try {    const { title } = req.params;
    const result = await pool.query(
        "SELECT * FROM jobs WHERE title = $1",
        [title] 
    );
    res.status(200).json(result.rows);
  }
    catch (error) {
    console.error("Error fetching jobs by title:", error);
    res.status(500).json({ error: "Failed to fetch jobs by title" });
  }
};

// GET JOBS BY DESCRIPTION
exports.getJobsByDescription = async (req, res) => {
  try {    const { description } = req.params;
    const result = await pool.query(
        "SELECT * FROM jobs WHERE description = $1",
        [description]
    );
    res.status(200).json(result.rows);
  }
    catch (error) {
    console.error("Error fetching jobs by description:", error);
    res.status(500).json({ error: "Failed to fetch jobs by description" });
  }
};

// GET JOBS BY PHONE
exports.getJobsByPhone = async (req, res) => {
  try {    const { phone } = req.params;
    const result = await pool.query(
        "SELECT * FROM jobs WHERE phone = $1",
        [phone]
    );
    res.status(200).json(result.rows);
  }
    catch (error) {
    console.error("Error fetching jobs by phone:", error);
    res.status(500).json({ error: "Failed to fetch jobs by phone" });
  }
};

// GET JOBS BY EMAIL
exports.getJobsByEmail = async (req, res) => {
  try {    const { email } = req.params;
    const result = await pool.query(
        "SELECT * FROM jobs WHERE email = $1",
        [email]
    );
    res.status(200).json(result.rows);
  }
    catch (error) {
    console.error("Error fetching jobs by email:", error);
    res.status(500).json({ error: "Failed to fetch jobs by email" });
  }
};

// GET JOBS BY COMPANY AND LOCATION
exports.getJobsByCompanyAndLocation = async (req, res) => {
  try {    const { company, location } = req.params;
    const result = await pool.query(
        "SELECT * FROM jobs WHERE company = $1 AND location = $2",
        [company, location]
    );
    res.status(200).json(result.rows);
  }
    catch (error) {
    console.error("Error fetching jobs by company and location:", error);
    res.status(500).json({ error: "Failed to fetch jobs by company and location" });
  }
};

