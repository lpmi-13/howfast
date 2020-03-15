#! /bin/python
import requests
from bs4 import BeautifulSoup
import json
import re

BASE_URL = 'https://en.wikipedia.org'

EVENT_LIST = [
    '100 m',
    '200 m',
    '400 m',
    '800 m',
    '1500 m',
    '5000 m',
    '10000 m',
    'Half marathon',
    'Marathon'
]

TIME_DICT = {}


# first, read in the file of national record URLs from wikipedia
with open('urls.txt', 'r') as input_file:
    data = input_file.readlines()

cleaned_data = [json.loads(line) for line in data]

# clean and return the time from the html
# unfortunately very tightly coupled to the structure of the wikipedia html :(


def get_time_from_html(data):
    raw_time = data.parent.next_sibling.next_sibling.text.strip()
    return raw_time.split(' ')[0] or None

# because sometimes the times will have weird chars like "+" at the end


def clean_numbers(time):
    return re.sub("[^0-9.:]", "", time)


def hundredths_to_millis(time):
    return int(time) * 10


def seconds_to_millis(time):
    return int(time) * 1000


def minutes_to_millis(time):
    return int(time) * 60 * 1000


def hours_to_millis(time):
    return int(time) * 60 * 60 * 1000

# this is to standardize all the measurements into milliseconds


def convert_times_to_milliseconds(time):

    cleaned_time = clean_numbers(time)

    # this is just til wikipedia updates for the rando times take effect
    if time == '16.38.8':
        return minutes_to_millis(
            '16') + seconds_to_millis('38') + hundredths_to_millis('8')
    if time == '30.13.74':
        return minutes_to_millis(
            '30') + seconds_to_millis('13') + hundredths_to_millis('74')

    # if it's one of the shorter races (100/200/400) with hundredths of seconds
    if (len(cleaned_time) <= 5) and ('.' in cleaned_time):
        seconds, hundredths = time.split('.')
        return seconds_to_millis(seconds) + hundredths_to_millis(hundredths)

    # if it's a longer race, but the time is very fast (eg, 58:42 for half
    # marathon)
    if (len(cleaned_time) <= 5) and (':' in cleaned_time):
        minutes, seconds = cleaned_time.split(':')
        return minutes_to_millis(minutes) + seconds_to_millis(seconds)

    # if it's a longer race that has both hours and hundredths (rare)
    if (len(cleaned_time) > 8) and (
            '.' in cleaned_time) and (':' in cleaned_time):
        rest, hundredths = cleaned_time.split('.')
        hours, minutes, seconds = rest.split(':')
        return hours_to_millis(hours) + minutes_to_millis(minutes) + \
            seconds_to_millis(seconds) + hundredths_to_millis(hundredths)

    # for one of the mid and longer distance track races (800/1500/5K/10K)
    # which still has hundredths of seconds
    elif (len(cleaned_time) > 5) and ('.' in cleaned_time):
        minutes, rest = cleaned_time.split(':')
        seconds, hundredths = rest.split('.')
        return minutes_to_millis(
            minutes) + seconds_to_millis(seconds) + hundredths_to_millis(hundredths)

    # for one of the longer distance road races (half marathon/marathon)
    # which does not have hundredths of seconds but does have hours
    else:
        hours, minutes, seconds = cleaned_time.split(':')
        return hours_to_millis(
            hours) + minutes_to_millis(minutes) + seconds_to_millis(seconds)


def get_times_for_country(country):
    # grab the page data and parse it
    r = requests.get(BASE_URL + country['url'])
    soup = BeautifulSoup(r.text)

    nation = country['country']

    print(nation)

    for event in EVENT_LIST:

        event_data = soup.find_all("a", string='{}'.format(event))

        try:
            mens_outdoor_time = get_time_from_html(event_data[0])
            print(mens_outdoor_time)

            if mens_outdoor_time is not None:
                TIME_DICT[event]['men'][nation] = convert_times_to_milliseconds(
                    mens_outdoor_time)

        except IndexError:
            print('no mens outdoor data')

        try:
            womens_outdoor_time = get_time_from_html(event_data[1])
            print(womens_outdoor_time)

            if womens_outdoor_time is not None:
                TIME_DICT[event]['women'][nation] = convert_times_to_milliseconds(
                    womens_outdoor_time)
        except IndexError:
            print('no womens outdoor data')


for event in EVENT_LIST:
    TIME_DICT[event] = {}
    TIME_DICT[event]['men'] = {}
    TIME_DICT[event]['women'] = {}

for country in cleaned_data:
    get_times_for_country(country)

with open('results.json', 'w') as output_file:
    output_file.write(json.dumps(TIME_DICT))
