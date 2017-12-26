# Tmux Status Daemon

[![Commitizen friendly][commitizen-image]][commitizen-url]
[![NPM version][npm-v-image]][npm-url]
[![NPM Downloads][npm-dm-image]][npm-url]


--------------------------------------------------------------------------------

## Installation

```sh
$ npm install -g tmux-status-daemon
```

--------------------------------------------------------------------------------

## Usage

You will have a tool after installation:

```sh
$ tmuxstatusd
```

This daemon listens to the `/tmp/tmux-status.sock` Unix socket.

You can check this (via the `netcat` for example):

```sh
$ echo "right" | nc -U /tmp/tmux-status.sock
```

And you will see:
<details>
<summary>Something like this</summary>
<pre><code>#[bg=#626262]#[fg=#121212] #[fg=#870087]superpaintman#[bg=#626262]#[fg=#121212,none]@#[fg=#870087]superpaintman-laptop#[bg=#626262]#[fg=#121212,none] #[bg=#1c1c1c] #[bg=#626262]#[fg=#121212,none]#[bg=#1c1c1c]#[fg=#005fff]⏹#[bg=#626262]#[fg=#121212,none]#[bg=#626262]#[fg=#121212,none]#[bg=#005fff] #[bg=#626262]#[fg=#121212,none]#[bg=#005fff]⚡#[bg=#626262]#[fg=#121212,none]#[bg=#005fff]1#[bg=#626262]#[fg=#121212,none]#[bg=#005fff]0#[bg=#626262]#[fg=#121212,none]#[bg=#005fff]0#[bg=#626262]#[fg=#121212,none]#[bg=#005fff]%#[bg=#626262]#[fg=#121212,none]#[bg=#005fff] #[bg=#626262]#[fg=#121212,none]#[bg=#1c1c1c] #[bg=#626262]#[fg=#121212,none] c: #[fg=#121212,bold]8#[bg=#626262]#[fg=#121212,none]% r: #[fg=#121212,bold]80#[bg=#626262]#[fg=#121212,none]% #[fg=#121212]🌡#[bg=#626262]#[fg=#121212,none]: #[fg=#121212,bold]64#[bg=#626262]#[fg=#121212,none]°c #[bg=#1c1c1c] #[bg=#626262]#[fg=#121212,none] 26/12 04:50:06 #[bg=#626262]#[fg=#121212,none]#[bg=#626262]#[fg=#121212,none]</code></pre>
</details>


Now you need to daemonize it as a service (on an init-based unix or Linux system):

```sh
$ cp /usr/lib/node_modules/tmux-status-daemon/extra/init.d/tmuxstatusd /etc/init.d/tmuxstatusd
$ chmod +x /etc/init.d/tmuxstatusd
$ systemctl daemon-reload
$ systemctl enable tmuxstatusd
$ systemctl start tmuxstatusd
```


Add the following line into your `~/.tmux.conf`:

```sh
set -g status-right '#(echo "right" | nc -U /tmp/tmux-status.sock)'
```

And then you will see this:

![Screenshot][screenshot-image]

--------------------------------------------------------------------------------

## Contributing

1. Fork it (<https://github.com/SuperPaintman/express-lazy-middleware/fork>)
2. Create your feature branch (`git checkout -b feature/<feature_name>`)
3. Commit your changes (`git commit -am '<type>(<scope>): added some feature'`)
4. Push to the branch (`git push origin feature/<feature_name>`)
5. Create a new Pull Request


--------------------------------------------------------------------------------

## Contributors

- [SuperPaintman](https://github.com/SuperPaintman) SuperPaintman - creator, maintainer


<!--
--------------------------------------------------------------------------------

## Changelog
[Changelog][changelog-url]
-->

--------------------------------------------------------------------------------

## License

[MIT][license-url]


[license-url]: https://raw.githubusercontent.com/SuperPaintman/tmux-status-daemon/master/LICENSE
[changelog-url]: https://raw.githubusercontent.com/SuperPaintman/tmux-status-daemon/master/CHANGELOG.md
[npm-url]: https://www.npmjs.com/package/tmux-status-daemon
[npm-v-image]: https://img.shields.io/npm/v/tmux-status-daemon.svg
[npm-dm-image]: https://img.shields.io/npm/dm/tmux-status-daemon.svg
[commitizen-image]: https://img.shields.io/badge/commitizen-friendly-brightgreen.svg
[commitizen-url]: https://commitizen.github.io/cz-cli/
[screenshot-image]: README/screenshot.png
