'use strict';
require("dotenv").config();
const Stocks = require('../models');
const fetch = require('node-fetch');

const saveStock = async (symbol, like, ip) => {
  try {
    let stockData = await Stocks.findOne({ symbol });

    if (!stockData) {
      let newStock = new Stocks({ symbol });
      if (like) {
        newStock.likes.push(ip);
      }
      await newStock.save();
    } else {
      if (!stockData.likes.includes(ip) && like) {
        stockData.likes.push(ip);
        await stockData.save();
      }
    }

    return Stocks.findOne({ symbol }); // Return the updated/created document
  } catch (err) {
    console.error("Error in saveStock:", err);
    throw err;
  }
};

const getStockPrice = (stockSymbol) =>
  fetch(`https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${stockSymbol}/quote`)
    .then((response) => response.json())
    .then((data) => ({
      stock: data.symbol,
      price: data.latestPrice,
    }));

const parseData = (data) => {
  let stockData = [];
  let i = 0;
  const likes = [];

  while (i < data.length) {
    const stock = {
      stock: data[i + 1].stock,
      price: data[i + 1].price,
    };
    likes.push(data[i].likes.length);
    stockData.push(stock);
    i += 2;
  }

  if (stockData.length === 2) {
    stockData[0].rel_likes = likes[0] - likes[1];
    stockData[1].rel_likes = likes[1] - likes[0];
  } else {
    stockData = stockData[0];
    stockData.likes = likes[0];
  }

  return { stockData };
};

module.exports = function (app) {
  app.route('/api/stock-prices')
    .get(async function (req, res) {
      let { stock, like } = req.query;
      if (!Array.isArray(stock)) stock = [stock];
      like = like === 'true';

      try {
        const promises = [];
        for (const symbol of stock) {
          promises.push(saveStock(symbol.toLowerCase(), like, req.ip));
          promises.push(getStockPrice(symbol));
        }

        const data = await Promise.all(promises);
        const parsedData = parseData(data);
        res.json(parsedData);
      } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
      }
    });
};
