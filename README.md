# howfast

A simple React app that shows users how many countries' national records in track and field they are faster than.

e.g., entering a time of 15:40 for the 5,000 meters returns "you are faster than the runners of 20 countries..." and lists them.

## Local developlment

```
$ npm install
$ npm start
```

## Grabbing the data

```
$ python grab_data.py
```

...updates the datetime in the json array for display on the site


### the old angularJS app

This involved a database and other backendy stuff, so have moved it to the `legacy`
tag if anyone is curious.
