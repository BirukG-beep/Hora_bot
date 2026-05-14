require("dotenv").config();

const { Telegraf, Markup } = require("telegraf");
const pool = require("./backend/db/db");

const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors({
  origin: "http://localhost:3000",
  credentials: true,
}));

const bot = new Telegraf("7972700389:AAGjjPAH73j1hQPNmMkd2VNRzOaH2vn_lj4");

const userData = {};

// ================= START =================
bot.start(async (ctx) => {
  await ctx.replyWithPhoto("https://picsum.photos/300", {
    caption: "Welcome to Hora Broker Bot",
  });

  await ctx.reply(
    "Choose Job Category",
    Markup.keyboard([
      ["Waiter", "Kitchen"],
      ["Cashier", "Delivery"],
      ["Manager"],
    ]).resize()
  );

  await ctx.reply("Or use /search to find jobs by keyword");
  await ctx.reply("Use /myjobs to see your applied jobs");
  await ctx.reply("Contact support: @horabrokersupport");
});

// ================= FILTER JOBS =================
bot.hears(
  ["Waiter", "Kitchen", "Cashier", "Delivery", "Manager"],
  async (ctx) => {
    try {
      const type = ctx.message.text;
      const result = await pool.query(
        `SELECT * FROM jobs WHERE type = $1 ORDER BY id DESC`,
        [type]
      );

      const jobs = result.rows;
      if (jobs.length === 0) return ctx.reply("No jobs found");

      for (const job of jobs) {
        await ctx.reply(
          `Job Title: ${job.title}\nType: ${job.type}\nDescription: ${job.description}\nCompany: ${job.company}\nLocation: ${job.location}\nPhone: ${job.phone}\nEmail: ${job.email}`,
          Markup.inlineKeyboard([[Markup.button.callback("Apply", `apply_${job.id}`)]])
        );
      }
    } catch (error) {
      console.error(error);
      ctx.reply("Error loading jobs");
    }
  }
);

// ================= APPLY =================
bot.action(/apply_(.+)/, async (ctx) => {
  try {
    const jobId = ctx.match[1];
    const telegramId = ctx.from.id;

    userData[telegramId] = {
      jobId,
      phone: null,
      location: null,
      experiences: [],
      step: "contact",
    };

    await ctx.reply(
      "Please share your phone and location",
      Markup.keyboard([
        [
          Markup.button.contactRequest("Share Phone"),
          Markup.button.locationRequest("Share Location"),
        ],
      ])
        .resize()
        .oneTime()
    );
  } catch (error) {
    console.error(error);
    ctx.reply("Application failed");
  }
});

// ================= CONTACT & LOCATION =================
bot.on("contact", async (ctx) => {
  const telegramId = ctx.from.id;
  const user = userData[telegramId];
  if (!user) return;

  user.phone = ctx.message.contact.phone_number;

  if (user.location && user.step === "contact") {
    user.step = "experience";
    return askForExperience(ctx);
  } else if (!user.location) {
    ctx.reply("Phone received. Now share your location.");
  }
});

bot.on("location", async (ctx) => {
  const telegramId = ctx.from.id;
  const user = userData[telegramId];
  if (!user) return;

  user.location = {
    latitude: ctx.message.location.latitude,
    longitude: ctx.message.location.longitude,
  };

  if (user.phone && user.step === "contact") {
    user.step = "experience";
    return askForExperience(ctx);
  } else if (!user.phone) {
    ctx.reply("Location received. Now share your phone.");
  }
});

// ================= EXPERIENCE FLOW =================
async function askForExperience(ctx) {
  await ctx.reply(
    `✅ Phone and location received!\n\n` +
    `Now add your work experience (you can add multiple):\n\n` +
    `Send in this format:\n` +
    `Company: Example Restaurant\n` +
    `Position: Senior Waiter\n` +
    `Year: 2022-2024`,
    Markup.inlineKeyboard([[Markup.button.callback("✅ Done with Experiences", "done_experience")]])
  );
}

// **Fixed Text Handler** - Only active during experience step
bot.on("text", async (ctx) => {
  const telegramId = ctx.from.id;
  const user = userData[telegramId];

  // Important: Ignore if not in experience step
  if (!user || user.step !== "experience") return;

  const text = ctx.message.text;
  const lines = text.split("\n");

  let company = "", position = "", year = "";

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes("company:")) company = line.split(":")[1]?.trim();
    if (lower.includes("position:")) position = line.split(":")[1]?.trim();
    if (lower.includes("year:")) year = line.split(":")[1]?.trim();
  }

  if (company && position && year) {
    user.experiences.push({ company, position, year });
    await ctx.reply(`✅ Experience added!\nYou can add more or click "Done".`);
  } else {
    await ctx.reply("❌ Wrong format!\nPlease use:\nCompany: ...\nPosition: ...\nYear: ...");
  }
});

// Done with experiences
bot.action("done_experience", async (ctx) => {
  const telegramId = ctx.from.id;
  const user = userData[telegramId];
  if (!user) return;

  await saveApplication(ctx, telegramId);
});

// ================= SAVE APPLICATION =================
async function saveApplication(ctx, telegramId) {
  try {
    const user = userData[telegramId];
    if (!user?.phone || !user?.location) {
      return ctx.reply("Missing phone or location.");
    }

    const firstName = ctx.from.first_name || "Unknown";

    const existing = await pool.query(
      `SELECT id FROM workers WHERE telegram_id = $1 AND job_id = $2`,
      [telegramId, user.jobId]
    );

    if (existing.rows.length > 0) {
      delete userData[telegramId];
      return ctx.reply("You have already applied to this job.");
    }

    await pool.query(
      `
      INSERT INTO workers (name, phone, location, telegram_id, job_id, experience)
      VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        firstName,
        user.phone,
        JSON.stringify(user.location),
        telegramId,
        user.jobId,
        JSON.stringify(user.experiences)
      ]
    );

    delete userData[telegramId];
    await ctx.reply("🎉 Application Submitted Successfully!");

  } catch (error) {
    console.error(error);
    ctx.reply("❌ Application failed. Please try again.");
  }
}


// ================= SEARCH =================

bot.command("search", async (ctx) => {
  try {
    const text = ctx.message.text.split(" ").slice(1).join(" ");

    if (!text) {
      return ctx.reply("Usage: /search keyword");
    }

    const result = await pool.query(
      `
      SELECT *
      FROM jobs
      WHERE
      title ILIKE $1
      OR description ILIKE $1
      OR company ILIKE $1
      `,
      [`%${text}%`]
    );

    const jobs = result.rows;

    if (jobs.length === 0) {
      return ctx.reply("No jobs found");
    }

    for (const job of jobs) {
      await ctx.reply(
        `Job Title: ${job.title}
Description: ${job.description}
Company: ${job.company}
Location: ${job.location}`,
        Markup.inlineKeyboard([
          [Markup.button.callback("Apply", `apply_${job.id}`)],
        ])
      );
    }

  } catch (error) {
    console.log(error);
    ctx.reply("Search failed");
  }
});


// ================= MY JOBS =================

bot.command("myjobs", async (ctx) => {
  try {
    const telegramId = ctx.from.id;

    const result = await pool.query(
      `
      SELECT jobs.*
      FROM workers
      JOIN jobs ON workers.job_id = jobs.id
      WHERE workers.telegram_id = $1
      `,
      [telegramId]
    );

    const jobs = result.rows;

    if (jobs.length === 0) {
      return ctx.reply("No applied jobs");
    }

    for (const job of jobs) {
      await ctx.reply(
        `Job Title: ${job.title}
Company: ${job.company}
Location: ${job.location}`
      );
    }

  } catch (error) {
    console.log(error);
    ctx.reply("Failed");
  }
});


// ================= LAUNCH =================

bot.launch();

console.log("Bot running...");

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
