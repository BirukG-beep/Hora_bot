require("dotenv").config();

const { Telegraf, Markup } = require("telegraf");
const pool = require("./backend/db/db");

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
  await ctx.reply("Follow us on Instagram: @horabrokers");
  await ctx.reply("Visit our website: https://horabrokers.com");
});


// ================= FILTER JOBS =================

bot.hears(
  ["Waiter", "Kitchen", "Cashier", "Delivery", "Manager"],
  async (ctx) => {
    try {
      const type = ctx.message.text;

      const result = await pool.query(
        `
        SELECT *
        FROM jobs
        WHERE type = $1
        ORDER BY id DESC
        `,
        [type]
      );

      const jobs = result.rows;

      if (jobs.length === 0) {
        return ctx.reply("No jobs found");
      }

      for (const job of jobs) {
        await ctx.reply(
          `Job Title: ${job.title}
Type: ${job.type}
Description: ${job.description}
Company: ${job.company}
Location: ${job.location}
Phone: ${job.phone}
Email: ${job.email}`,
          Markup.inlineKeyboard([
            [Markup.button.callback("Apply", `apply_${job.id}`)],
          ])
        );
      }
    } catch (error) {
      console.log(error);
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
    console.log(error);
    ctx.reply("Application failed");
  }
});


// ================= CONTACT =================

bot.on("contact", async (ctx) => {
  try {
    const telegramId = ctx.from.id;
    const phoneNumber = ctx.message.contact.phone_number;

    const user = userData[telegramId];

    if (!user) {
      return ctx.reply("No selected job");
    }

    user.phone = phoneNumber;

    if (!user.location) {
      return ctx.reply("Phone received. Now share your location.");
    }

    await saveApplication(ctx, telegramId);

  } catch (error) {
    console.log(error);
    ctx.reply("Failed to save phone");
  }
});


// ================= LOCATION =================

bot.on("location", async (ctx) => {
  try {
    const telegramId = ctx.from.id;

    const user = userData[telegramId];

    if (!user) {
      return ctx.reply("No selected job");
    }

    user.location = {
      latitude: ctx.message.location.latitude,
      longitude: ctx.message.location.longitude,
    };

    if (!user.phone) {
      return ctx.reply("Location received. Now share your phone.");
    }

    await saveApplication(ctx, telegramId);

  } catch (error) {
    console.log(error);
    ctx.reply("Failed to save location");
  }
});


// ================= SAVE APPLICATION =================

async function saveApplication(ctx, telegramId) {
  try {
    const user = userData[telegramId];

    if (!user.phone || !user.location) {
      return;
    }

    const firstName = ctx.from.first_name || "";
    const jobId = user.jobId;

    const existing = await pool.query(
      `
      SELECT *
      FROM workers
      WHERE telegram_id = $1 AND job_id = $2
      `,
      [telegramId, jobId]
    );

    if (existing.rows.length > 0) {
      return ctx.reply("Already Applied");
    }

    await pool.query(
      `
      INSERT INTO workers (
        name,
        phone,
        location,
        telegram_id,
        job_id,
        experience
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        firstName,
        user.phone,
        JSON.stringify(user.location),
        telegramId,
        jobId,
        JSON.stringify([]),
      ]
    );

    delete userData[telegramId];

    await ctx.reply("Job Application Submitted");

  } catch (error) {
    console.log(error);
    ctx.reply("Application failed");
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