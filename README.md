# howfast

### the old angularJS app

This involved a database and other backendy stuff, so have moved it to the `legacy`
branch if anyone is curious.


A simple React app that shows users how many countries' national records in track and field they are faster than.

e.g., entering a time of 15:40 for the 5,000 meters returns "you are faster than the runners of 20 countries..." and lists them.

All data was taken from Wikipedia and is current as of January 26, 2020.

## Local developlment

```
$ npm install
$ npm start
```

## Grabbing the data

```
$ python grab_data.py
```

...outputs to local file `results.json`
