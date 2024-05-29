#!/usr/bin/env python
# coding: utf-8

import numpy as np
import matplotlib.pyplot as plt
import datetime as dt
import matplotlib.dates as md
import matplotlib.animation as animation
from capybot import load_data
import sys

# Do not use automatic offsets for plot axis
import matplotlib as mpl

mpl.rcParams['axes.formatter.useoffset'] = False

if len(sys.argv) != 2:
    sys.exit("No path to Capybot log file given")

file = sys.argv[1]

# Readable names for pools
pools = {
    'b0e82344-84a2-5b84-9cbc-d3048eb16e32': 'Cetus USDC/SUI',
    'eb53e90b-eb26-5d4d-9ec1-10678a21a2e7': 'RAMM USDC/SUI',
}

fig, ax = plt.subplots(1,1)

def animate_prices(j):
    data = load_data(file);
    ax.clear()
    ax.set_title('Price development (A to B)')
    for source in data['prices']:
        prices = data['prices'][source]['price'];
        normalized = np.multiply(prices, 1 / data['prices'][source]['offset'])
        timestamps = data['prices'][source]['time'];
        min_ts = min(timestamps)
        timestamps = [ts - min_ts for ts in timestamps]
        ax.plot(timestamps, normalized, label = pools[source])
    ax.legend();

anim = animation.FuncAnimation(fig, animate_prices, interval = 1000)

plt.xlabel('Time (s)')
plt.ylabel('Price (normalized)')
plt.show(block = True)