#!/usr/bin/env python
# coding: utf-8

import matplotlib.pyplot as plt
import matplotlib.dates as md
import matplotlib.animation as animation
from capybot import load_data
import sys

ARBITRAGE_RELATIVE_LIMIT = 1.0005

# Do not use automatic offsets for plot axis
import matplotlib as mpl
mpl.rcParams['axes.formatter.useoffset'] = False

if len(sys.argv) < 2:
    sys.exit("No path to Capybot log file given")

file = sys.argv[1]

data = load_data(file);
number_of_strategies = len(data['strategies']);

fig, ax = plt.subplots(nrows = number_of_strategies, ncols = 1, figsize = (6, 10));
fig.tight_layout(pad=2.0)

def animate_strategies(j):
    # Recall that this is going to be done once a second - visualizing logs from long-running
    # instances should be done in a static manner, without animation
    data = load_data(file);

    # if only one arbitrage strategy is being used, the ax object is not iterable,
    # and will not be subscriptable - thus the checked
    if number_of_strategies > 1:
        ax_object = ax[i]
    else:
        ax_object = ax

    for i, uri in enumerate(data['strategies']):
        strategy = data['strategies'][uri]
        ax_object.clear()
        ax_object.set_title(strategy['parameters']['name'] + "")

        ax_object.set_xlabel('Time (s)')
        ax_object.set_ylabel('Arbitrage potential')

        # A horizontal line is drawn at the relative limit at which arbitrage is considered
        ax_object.axhline(y = ARBITRAGE_RELATIVE_LIMIT, color = 'black', linestyle = '--', label = 'Arbitrage threshold')

        timestamps = strategy['statuses']['time']
        start_ts = timestamps[0]

        # Convert UNIX timestamps to seconds since the start of the simulation
        timestamps = [ts - start_ts for ts in timestamps]

        # No recorded statuses, skip
        if len(strategy['statuses']['value']) == 0:
            break

        for key in strategy['statuses']['value'][0]:
            y = list(map(lambda x: x[key], strategy['statuses']['value']))
            ax_object.plot(timestamps, y, label = key)

        # A trade order is indicated by a vertical red line
        if uri in data['orders']:
            order_ts = [ts - start_ts for ts in data['orders'][uri]['time']];
            # Set the label for all trade orders once
            ax_object.axvline(color = 'r', label = 'Trade order')
            for order_t in order_ts:
                ax_object.axvline(x = order_t, color = 'r', linestyle = '-.', alpha = 0.05)

        ax_object.legend();

switch = sys.argv[2]

if switch == '--static':
    animate_strategies(0)
    plt.show()
elif switch == '--dynamic':
    anim = animation.FuncAnimation(fig, func = animate_strategies, interval = 1000)
    plt.show()
else: 
    sys.exit("Invalid switch given: use either `--static` or `--dynamic`")
