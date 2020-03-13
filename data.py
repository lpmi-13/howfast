#! /bin/python
import requests
from bs4 import BeautifulSoup

BASE_URL = 'https://en.wikipedia.org/wiki/National_records_in_athletics'

def get_list_of_countries(url):
    
