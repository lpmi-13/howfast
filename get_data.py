#! /bin/python
from bs4 import BeautifulSoup
import datetime
import json
import os
import re
import requests

BASE_URL = 'https://en.wikipedia.org'
OUTPUT_PATH = 'src/data'
OUTPUT_FILE = 'results.json'

EVENT_LIST = [
    '100 metres',
    '200 metres',
    '400 metres',
    '800 metres',
    '1500 metres',
    '5000 metres',
    '10,000 metres',
    'Half marathon',
    'Marathon'
]

TIME_DICT = {'events': {}, 'generated_at': ''}


# first, read in the file of national record URLs from wikipedia
with open('urls.txt', 'r') as input_file:
    data = input_file.readlines()

cleaned_data = [json.loads(line) for line in data]


def get_time_from_html(data):
    '''
    clean and return the time from the html
    unfortunately very tightly coupled to the structure of the wikipedia html :(
    '''
    raw_time = data.parent.next_sibling.next_sibling.text.strip()
    return raw_time.split(' ')[0] or None


def clean_numbers(time):
    # because sometimes the times will have weird chars like "+" at the end
    return re.sub("[^0-9.:]", "", time)


def hundredths_to_millis(time):
    return int(time) * 10


def seconds_to_millis(time):
    return int(time) * 1000


def minutes_to_millis(time):
    return int(time) * 60 * 1000


def hours_to_millis(time):
    return int(time) * 60 * 60 * 1000


def convert_times_to_milliseconds(time):
    # this is to standardize all the measurements into milliseconds
    cleaned_time = clean_numbers(time)

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
    soup = BeautifulSoup(r.text, 'html.parser')

    nation = country['country']

    print(nation)

    for event in EVENT_LIST:

        event_data = soup.find_all("a")
        # this is a hack cuz the brits also list all walking events
        filtered_links = [
            link for link in event_data if link.get('title') == event]

        try:
            mens_outdoor_time = get_time_from_html(filtered_links[0])
            print(mens_outdoor_time)

            if mens_outdoor_time is not None:
                TIME_DICT['events'][event]['men'].append(
                    [nation, convert_times_to_milliseconds(mens_outdoor_time)])

        except IndexError:
            print('no mens outdoor data')

        try:
            womens_outdoor_time = get_time_from_html(filtered_links[1])
            print(womens_outdoor_time)

            if womens_outdoor_time is not None:
                TIME_DICT['events'][event]['women'].append(
                    [nation, convert_times_to_milliseconds(womens_outdoor_time)])
        except IndexError:
            print('no womens outdoor data')


# add these to the dicts so we dont get key errors
for event in EVENT_LIST:
    TIME_DICT['events'][event] = {}
    TIME_DICT['events'][event]['men'] = []
    TIME_DICT['events'][event]['women'] = []

for country in cleaned_data:
    get_times_for_country(country)

# now sort the times per gender per event in descending order so we can
# map over them in the frontend without needing to sort
for event in TIME_DICT['events']:
    temp_list = []
    for gender_list in TIME_DICT['events'][event]:
        times_list = TIME_DICT['events'][event][gender_list]
        TIME_DICT['events'][event][gender_list] = sorted(
            times_list, key=lambda entry: entry[1])

# generate a datestamp for display on the site
current_date = datetime.datetime.now()

date_for_display = "Times current as of {}".format(
    current_date.strftime("%b %d %Y"))

TIME_DICT['generated_at'] = date_for_display

if not os.path.exists(OUTPUT_PATH):
    os.mkdir(OUTPUT_PATH)

with open(os.path.join(OUTPUT_PATH, OUTPUT_FILE), 'w') as output_file:
    output_file.write(json.dumps(TIME_DICT))
