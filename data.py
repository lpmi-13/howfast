#! /bin/python
import requests
from bs4 import BeautifulSoup

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

# first, read in the file of national record URLs from wikipedia
with open('urls.txt', 'r') as input_file:
    data = input_file.readlines()

cleaned_data = [line.strip() for line in data]

def get_times_for_country(url):
   # grab the page data and parse it
   r = requests.get(BASE_URL + url)
   soup = BeautifulSoup(r.text)

   for event in EVENT_LIST:
       print(event)
       event_data = soup.find_all("a", string='{}'.format(event))
       # mens outdoor times are in the first table
       try:
           mens_outdoor = event_data[0].parent.next_sibling.next_sibling.text.strip() 

           mens_outdoor_time = mens_outdoor.split(' ')[0]
           print(mens_outdoor_time)
       except IndexError:
           print('no mens outdoor data')

       # womens outdoor times are in the second table
       try:
           womens_outdoor = event_data[1].parent.next_sibling.next_sibling.text.strip()
 
           womens_outdoor_time = womens_outdoor.split(' ')[0]
           print(womens_outdoor_time)
       except IndexError:
           print('no womens outdoor data')


for country in cleaned_data:
    get_times_for_country(country)
