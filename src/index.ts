import { Ed25519Keypair } from "@mysten/sui.js";
import { Suibot } from "./suibot";
import { BinanceBTCtoUSDC } from "./data_sources/binance/BinanceBTCtoUSDC";
import { CetusPool } from "./dexs/cetus/cetus";
import { TurbosPool } from "./dexs/turbos/turbos";
import { Arbitrage } from "./strategies/arbitrage";
import { MarketDifference } from "./strategies/market_difference";
import { RideTheTrend } from "./strategies/ride_the_trend";
import { RideTheExternalTrend } from "./strategies/ride_the_external_trend";
import 'dotenv/config';
import { Bot, Context, InlineKeyboard } from "grammy";
import { logger } from "./logger";
import axios from "axios";
import {
  JsonRpcProvider,
  Keypair,
  RawSigner,
  TransactionBlock,
  mainnetConnection,
} from "@mysten/sui.js";


const client = new JsonRpcProvider(mainnetConnection);


const subscribetokriyanewpools = async () => {
  try {
    const response = await client.subscribeEvent({
      filter: {
        Package: '0xa0eba10b173538c8fecca1dff298e488402cc9ff374f8a12ca7758eebe830b66',
        MoveModule: {
          package: '0xa0eba10b173538c8fecca1dff298e488402cc9ff374f8a12ca7758eebe830b66',
          module: 'spot_dex'
        },
        MoveEventType: 'create_pool_'
      },
      onMessage: (event) => {
        console.log(event);
      }
    });
    console.log(response);
  } catch (error) {
    console.error(error);
  }
}


// Convenience map from name to address for commonly used coins
export const coins = {
  SUI: "0x2::sui::SUI",
  USDC: "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN",
  CETUS: "0x06864a6f921804860930db6ddbe2e16acdf8504495ea7481637a1c8b9a8fe54b::cetus::CETUS",
  CETUS0: "0x6864a6f921804860930db6ddbe2e16acdf8504495ea7481637a1c8b9a8fe54b::cetus::CETUS",
  BRT: "0x5580c843b6290acb2dbc7d5bf8ab995d4d4b6ba107e2a283b4d481aab1564d68::brt::BRT",
  WETH: "0xaf8cd5edc19c4512f4259f0bee101a40d41ebed738ade5874359610ef8eeced5::coin::COIN",
  TOCE: "0xd2013e206f7983f06132d5b61f7c577638ff63171221f4f600a98863febdfb47::toce::TOCE",
  USDT: "0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab08c::coin::COIN",
  WBTC: "0x027792d9fed7f9844eb4839566001bb6f6cb4804f66aa2da6fe1ee242d896881::coin::COIN",
};

// Setup default amount to trade for each token in each pool. Set to approximately 1 USD each.
export const defaultAmount: Record<string, number> = {};
defaultAmount[coins.SUI] = 1_000_000_000;
defaultAmount[coins.USDC] = 1_000_000;
defaultAmount[coins.CETUS] = 15_000_000_000;
defaultAmount[coins.CETUS0] = 15_000_000_000;
defaultAmount[coins.BRT] = 150_000_000_000_000;
defaultAmount[coins.WETH] = 100_000;
defaultAmount[coins.TOCE] = 100_000_000_000;
defaultAmount[coins.USDT] = 1_000_000;
defaultAmount[coins.WBTC] = 3_000;

// A conservative upper limit on the max gas price per transaction block in SUI
export const MAX_GAS_PRICE_PER_TRANSACTION = 4_400_000;

const RIDE_THE_TREND_LIMIT = 1.000005;
const ARBITRAGE_RELATIVE_LIMIT = 1.0001;
const MARKET_DIFFERENCE_LIMIT = 1.01;

// Setup wallet from passphrase.
const phrase = process.env.ADMIN_PHRASE;


if (!phrase) {
  throw new Error("ADMIN_PHRASE environment variable is not set.");
}
export const keypair = Ed25519Keypair.deriveKeypair(phrase);

const publickey = keypair.getPublicKey().toSuiAddress();



let suibot = new Suibot(keypair);

const cetusUSDCtoSUI = new CetusPool(
  "0xcf994611fd4c48e277ce3ffd4d4364c914af2c3cbb05f7bf6facd371de688630",
  coins.USDC,
  coins.SUI
);
const cetusCETUStoSUI = new CetusPool(
  "0x2e041f3fd93646dcc877f783c1f2b7fa62d30271bdef1f21ef002cebf857bded",
  coins.CETUS,
  coins.SUI
);
const cetusUSDCtoCETUS = new CetusPool(
  "0x238f7e4648e62751de29c982cbf639b4225547c31db7bd866982d7d56fc2c7a8",
  coins.USDC,
  coins.CETUS
);
const turbosSUItoUSDC = new TurbosPool(
  "0x5eb2dfcdd1b15d2021328258f6d5ec081e9a0cdcfa9e13a0eaeb9b5f7505ca78",
  coins.SUI,
  coins.USDC,
  "0x91bfbc386a41afcfd9b2533058d7e915a1d3829089cc268ff4333d54d6339ca1::fee3000bps::FEE3000BPS"
);
const cetusWBTCtoUSDC = new CetusPool(
  "0xaa57c66ba6ee8f2219376659f727f2b13d49ead66435aa99f57bb008a64a8042",
  coins.WBTC,
  coins.USDC
);

// Setup your Telegram bot
const botToken = process.env.TELEGRAM_BOT_TOKEN;

if (!botToken) {
  throw new Error("TELEGRAM_BOT_TOKEN environment variable is not set.");
}

const bot = new Bot(botToken);
const API_ID = process.env.API_ID

// Get token data from Zettablock API
async function queryToken(symbol: string) {
	var result
	const options = {
		method: 'POST',
		url: `https://api.zettablock.com/api/v1/dataset/${API_ID}/graphql`,
		headers: {
			accept: 'application/json',
			'X-API-KEY': process.env.ZETTABLOCKAPIKEY,
			'content-type': 'application/json',
		},
		data: {
			// GraphQL query starts here, token symbol is passed as a variable
			query: `
				{
					records(symbol: "${symbol}", limit: 2 )
					{
            object_id,
            coin_type,
            symbol,
            decimals,
            total_supply_amount,
            name
					}
				}
			`,
		},
	}

	await axios
		.request(options) // Send the request to Zettablock API
		.then(function (response) {
			// If the request is successful, return the data
			// console.log(response.data.data.records)
			result = response.data.data.records
		})
		.catch(function (error) {
			// If the request is failed, return the error
			console.error(error)
		})
	// return the result array
	return result
}

async function queryprice(symbol: string) {
  var result
  const options = {
    method: 'POST',
    url: `https://api.zettablock.com/api/v1/dataset/${API_ID}/graphql`,
    headers: {
      accept: 'application/json',
      'X-API-KEY': process.env.ZETTABLOCKAPIKEY,
      'content-type': 'application/json',
    },
    data: {
      // GraphQL query starts here, token symbol is passed as a variable
      query: `
        {
          records(symbol: "${symbol}", limit: 1 )
          {
            price
          }
        }
      `,
    },
  }
};

// Handle the /start command.
bot.command("start", (ctx) => {

  const keyboard = new InlineKeyboard()
  .text("Import Wallet", "import-wallet")
  .text("Show My Wallet", "show-wallet")
  
  ctx.reply("Welcome to the Suibot! Use /help to see available commands.", { reply_markup: keyboard });
});


bot.command("help", (ctx) => {
  ctx.reply("Here are the available commands:\n\n" +
    "/prices - Get current prices\n" +
    "/trade - Initiate a trade\n" +
    "/subscribe - Subscribe to price alerts\n" +
    "/leaderboard - View the trading leaderboard\n"+
    "/chart - Generate a Live chart\n" +
    "/discuss - Start a discussion\n" +
    "/addpool - Add a pool\n" +
    "/adddatasource - Add a data source\n" +
    "/addstrategy - Add a strategy\n" +
    "/subscribetokriyanewpools - Subscribe to new pools on kriya\n" +
    "/lp - Provide Liquidity to pools on kriya or Scaloop \n" +
    "/starttrading - Start trading" 
  );
});

bot.command("chart", (ctx) => {

  const keyboard = new InlineKeyboard()
  .text("Generate a chart for Live Pools", "chartpools")
  .text("Generate a chart for Live Strategies", "chartstrategies")
  
  ctx.reply("Welcome to the Sharky the Sui trading bot! Use /help to see available commands.", { reply_markup: keyboard });
});


bot.command("token", async (msg) => {
	const chatId : number = msg.chat.id
	const symbol = msg.message?.text.split(' ')[1]

	// Query the token data
	var data : any= await queryToken(symbol!);
  
  console.log(data,"data")

	// data[0] is the first element of the array, which is the latest record
	// data.length == 0 means the token is not found
	if (data?.length == 0) {
		// If the token is not found, send a message
    // @ts-ignore
		msg.reply(chatId, 'Token not found, Please check the symbol again')
		return
	} else {
		data = data[0]
	}

	// send token data
	const replyMsg = `
    🪙 SUI Token Data:
	- Name: ${data.name}
    - Token: ${data.symbol}
    - Supply: ${data?.total_supply_amount}
	- Type: ${data.coin_type}
  - Decimals: ${data.decimals}
	- Object ID: ${data.object_id}
`
// @ts-ignore
	msg.reply(chatId, replyMsg) // Send the message to the chat
})


bot.command("prices", async (ctx) => {
  try {
    let prices = await suibot.getPrices();
    ctx.reply(`Current prices:\n\n${prices}`);
  } catch (error) {
    ctx.reply("Failed to get prices. Please try again later.");
    logger.error(error);
  }
});


bot.command("trade", (ctx) => {
  const keyboard = new InlineKeyboard()
    .text("SUI/USDC", "sui_usdc_trade")
    .text("CETUS/SUI", "cetus_sui_trade")
    .text("USDC/CETUS", "usdc_cetus_trade");
  ctx.reply("Select a trading pair:", { reply_markup: keyboard });
});

bot.command("LPintokriyapool", (ctx) => {
  const keyboard = new InlineKeyboard()
    .text("SUI/wUSDCe", "sui_usdc_pool")
    .text("vSUI/SUI", "cetus_sui_trade")
    .text("USDC/CETUS", "usdc_cetus_trade");
  ctx.reply("Select a trading pair:", { reply_markup: keyboard });
});

bot.command("subscribetokriyanewpools", async (ctx) =>  {
  await subscribetokriyanewpools();
  ctx.reply(`Subscribed ✅ ,whenever new pools are created on kriya you will be notified`);
});


bot.command("leaderboard", (ctx) => {
  const leaderboard = suibot.getLeaderboard();
  let message = "Trading Leaderboard:\n\n";
  for (const [user, profit] of leaderboard) {
    message += `${user}: ${profit} SUI\n`;
  }
  ctx.reply(message);
});


bot.callbackQuery("chartstrategies", async (ctx) => {
  try {
    // const chart = await suibot.generateChart();
    ctx.replyWithPhoto("https://raw.githubusercontent.com/CryptoInnovators/sharkythesuibot/master/monitoring-scripts/images/strategies.png?token=GHSAT0AAAAAACPRXGGBSETYALS2R674EVBQZS3CM5Q");
  } catch (error) {
    ctx.reply("Failed to generate chart. Please try again later.");
    logger.error(error);
  }
});

bot.callbackQuery("chartpools", async (ctx) => {
  try {
    // const chart = await suibot.generateChart();
    ctx.replyWithPhoto("https://github.com/CryptoInnovators/sharkythesuibot/blob/master/images/pools.png?raw=true");
  } catch (error) {
    ctx.reply("Failed to generate chart. Please try again later.");
    logger.error(error);
  }
});

bot.command("discuss", (ctx) => {
  const messageParts = ctx.message?.text.split(" ");
  if (messageParts?.length !== 2) {
    ctx.reply("Usage: /discuss <topic>");
    return;
  }

  const [_, topic] = messageParts;
  suibot.createDiscussion(topic);
  ctx.reply(`Discussion on ${topic} started. Join the discussion!`);
});


bot.command("addpool", (ctx) => {
  const messageParts = ctx.message?.text.split(" ");
  if (messageParts?.length !== 2) {
    ctx.reply("Usage: /addpool <pool> , currently supported pools : cetus_usdc_sui | cetus_cetus_sui | cetus_usdc_cetus | turbos_sui_usdc | cetus_wbtc_usdc");
    return;
  }

  const [_, pool] = messageParts;
  try {
    switch (pool) {
      case "cetus_usdc_sui":
        suibot.addPool(cetusUSDCtoSUI);
        ctx.reply("Added pool Cetus USDC/SUI.");
        break;
      case "cetus_cetus_sui":
        suibot.addPool(cetusCETUStoSUI);
        ctx.reply("Added pool Cetus CETUS/SUI.");
        break;
      case "cetus_usdc_cetus":
        suibot.addPool(cetusUSDCtoCETUS);
        ctx.reply("Added pool Cetus USDC/CETUS.");
        break;
      case "turbos_sui_usdc":
        suibot.addPool(turbosSUItoUSDC);
        ctx.reply("Added pool Turbos SUI/USDC.");
        break;
      case "cetus_wbtc_usdc":
        suibot.addPool(cetusWBTCtoUSDC);
        ctx.reply("Added pool Cetus WBTC/USDC.");
        break;
      default:
        ctx.reply("Invalid pool. Available pools: cetus_usdc_sui, cetus_cetus_sui, cetus_usdc_cetus, turbos_sui_usdc, cetus_wbtc_usdc.");
    }
  } catch (error : any) {
    if (error.message.includes("has already been added")) {
      ctx.reply(`Pool ${pool} has already been added.`);
    } else {
      ctx.reply("Failed to add pool. Please try again later.");
      logger.error(error);
    }
  }
});


bot.command("adddatasource", (ctx) => {
  const messageParts = ctx.message?.text.split(" ");
  if (messageParts?.length !== 2) {
    ctx.reply("Usage: /adddata source <data source>");
    return;
  }

  const [_, dataSource] = messageParts;
  switch (dataSource) {
    case "binance_btc_usdc":
      suibot.addDataSource(new BinanceBTCtoUSDC());
      ctx.reply("Added data source Binance BTC/USDC.");
      break;
    default:
      ctx.reply("Invalid data source. Available data sources: binance_btc_usdc.");
  }
});

bot.command("subscribe", (ctx) => {
  const messageParts = ctx.message?.text.split(" ");
  if (messageParts?.length !== 3) {
    ctx.reply("Usage: /subscribe <pair> <threshold>");
    return;
  }

  const [_, pair, threshold] = messageParts;
  suibot.subscribeToAlerts(pair, parseFloat(threshold));
  ctx.reply(`Subscribed to price alerts for ${pair} with threshold ${threshold}.`);
});

bot.command("addstrategy", (ctx) => {
  const messageParts = ctx.message?.text.split(" ");
  if (messageParts?.length !== 2) {
    ctx.reply("Usage: /addstrategy <strategy>");
  return;
  }
  // add all the pools for implementing the strategies on them
  suibot.addPool(cetusUSDCtoSUI);
  suibot.addPool(cetusUSDCtoCETUS);
  suibot.addPool(turbosSUItoUSDC);
  suibot.addPool(cetusCETUStoSUI);
  suibot.addPool(cetusWBTCtoUSDC);

  const [_, strategy] = messageParts;
  switch (strategy) {
    case "arbitrage":
      suibot.addStrategy(
        new Arbitrage(
          [
            {
              pool: turbosSUItoUSDC.uri,
              a2b: true,
            },
            {
              pool: cetusUSDCtoCETUS.uri,
              a2b: true,
            },
            {
              pool: cetusCETUStoSUI.uri,
              a2b: true,
            },
          ],
          defaultAmount[coins.SUI],
          ARBITRAGE_RELATIVE_LIMIT,
          "Arbitrage: SUI -Turbos-> USDC -Cetus-> CETUS -Cetus-> SUI"
        )
      );
      
      suibot.addStrategy(
        new Arbitrage(
          [
            {
              pool: turbosSUItoUSDC.uri,
              a2b: true,
            },
            {
              pool: cetusUSDCtoSUI.uri,
              a2b: true,
            },
          ],
          defaultAmount[coins.SUI],
          ARBITRAGE_RELATIVE_LIMIT,
          "Arbitrage: SUI -Turbos-> USDC -Cetus-> SUI"
        )
      );
      ctx.reply("Added strategy Arbitrage.");
      break;
    case "market_difference":
      suibot.addStrategy(
        new MarketDifference(
          cetusWBTCtoUSDC,
          "BinanceBTCtoUSDC",
          [defaultAmount[coins.WBTC], defaultAmount[coins.USDC]],
          MARKET_DIFFERENCE_LIMIT,
          "Market diff: (W)BTC/USDC, Binance vs CETUS"
        )
      );
      ctx.reply("Added strategy Market Difference.");
      break;
    case "ride_the_trend":
      suibot.addStrategy(
        new RideTheTrend(
          cetusUSDCtoSUI.uri,
          5,
          10,
          [
            defaultAmount[cetusUSDCtoSUI.coinTypeA],
            defaultAmount[cetusUSDCtoSUI.coinTypeB],
          ],
          RIDE_THE_TREND_LIMIT,
          "RideTheTrend (USDC/SUI)"
        )
      );
      suibot.addStrategy(
        new RideTheTrend(
          cetusCETUStoSUI.uri,
          5,
          10,
          [
            defaultAmount[cetusCETUStoSUI.coinTypeA],
            defaultAmount[cetusCETUStoSUI.coinTypeB],
          ],
          RIDE_THE_TREND_LIMIT,
          "RideTheTrend (CETUS/SUI)"
        )
      );
      suibot.addStrategy(
        new RideTheTrend(
          cetusUSDCtoCETUS.uri,
          5,
          10,
          [
            defaultAmount[cetusUSDCtoCETUS.coinTypeA],
            defaultAmount[cetusUSDCtoCETUS.coinTypeB],
          ],
          RIDE_THE_TREND_LIMIT,
          "RideTheTrend (USDC/CETUS)"
        )
      );
      ctx.reply("Added strategy Ride the Trend to the pools.");
      break;
    case "ride_the_external_trend":

    suibot.addStrategy(
      new RideTheExternalTrend(
        cetusWBTCtoUSDC.uri,
        "BinanceBTCtoUSDC",
        5,
        10,
        [defaultAmount[coins.WBTC], defaultAmount[coins.USDC]],
        RIDE_THE_TREND_LIMIT,
        1.0001,
        "Ride external trend: (W)BTC/USDC, Binance vs CETUS"
      ));
      ctx.reply("Added strategy Ride the External Trend.");
      break;
    default:
      ctx.reply("Invalid strategy. Available strategies: arbitrage, market_difference, ride_the_trend, ride_the_external_trend.");
  }
});



bot.command("starttrading", (ctx) => {
  ctx.reply("Started trading! 🚀");
  // Start the bot 1hr loop
  suibot.loop(3.6e6, 1000);
});

bot.callbackQuery("import-wallet", (ctx) => {
  ctx.reply("Import wallet clicked");
});

bot.callbackQuery("show-wallet", async (ctx) => {

  const response = await client.getBalance({owner: publickey});
  const convert = Number(response.totalBalance) / 1000000000;
  console.log(response);
  ctx.reply(`Your wallet address is: ${publickey} with balance: ${convert} SUI`);

});

// Handle callback queries from the inline keyboard.
bot.callbackQuery("sui_usdc_trade", async (ctx) => {
  await ctx.reply("Trading SUI/USDC...");
  await ctx.answerCallbackQuery(); // Acknowledge the callback query
  await executeTrade(ctx, suibot, "SUI", "USDC");
});

bot.callbackQuery(" ", async (ctx) => {
  await ctx.reply("Trading CETUS/SUI...");
  await ctx.answerCallbackQuery(); // Acknowledge the callback query
  await executeTrade(ctx, suibot, "CETUS", "SUI");
});

bot.callbackQuery("usdc_cetus_trade", async (ctx) => {
  await ctx.reply("Trading USDC/CETUS...");
  await ctx.answerCallbackQuery(); // Acknowledge the callback query
  await executeTrade(ctx, suibot, "USDC", "CETUS");
});


async function executeTrade(ctx: Context, suibot: Suibot, base: string, quote: string) {
  try {
    await suibot.executeTrade(base, quote);
    ctx.reply(`Trade ${base}/${quote} executed successfully.`);
  } catch (error) {
    ctx.reply(`Failed to execute trade ${base}/${quote}.`);
    logger.error(error);
  }
}

bot.on("message", (ctx) => ctx.reply("Unknown command. Use /help to see available commands."));


bot.start().then(() => {
  console.log('Bot started successfully');
}).catch((error) => {
  console.error('Failed to start the bot:', error);
});

