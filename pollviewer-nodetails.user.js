// ==UserScript==
// @name         show poll results
// @version      1.0.0
// @description  view tumblr poll results with a button
// @author       dragongirlsnout, ranidspace
// @match        https://www.tumblr.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=tumblr.com
// @downloadURL  https://github.com/ranidspace/show-poll-results/raw/main/pollviewer.user.js
// @updateURL    https://github.com/ranidspace/show-poll-results/raw/main/pollviewer.user.js
// @require      https://code.jquery.com/jquery-3.6.4.min.js
// @grant        none
// @run-at       document-start
// ==/UserScript==

'use strict';
const $ = window.jQuery;

const main = async function (nonce) {
  const $a = selector => document.querySelectorAll(selector);
  const $ = selector => document.querySelector(selector);
  const $str = str => {
    let elem = document.createElement('div');
    elem.innerHTML = str;
    elem = elem.firstElementChild;
    return elem;
  };
  
  const getUtilities = async function () {
    let retries = 0;
    while (retries++ < 1000 && (typeof window.tumblr === 'undefined' || typeof window.tumblr.getCssMap === 'undefined')) {
      await new Promise((resolve) => setTimeout(resolve));
    }
    const cssMap = await window.tumblr.getCssMap();
    const keyToClasses = (...keys) => keys.flatMap(key => cssMap[key]).filter(Boolean);
    const keyToCss = (...keys) => `:is(${keyToClasses(...keys).map(className => `.${className}`).join(', ')})`;
    return { keyToClasses, keyToCss};
  };

  document.addEventListener('DOMContentLoaded', () => {
    getUtilities().then(({ keyToCss, keyToClasses }) => {
      const answerSelector = '[data-testid="poll-answer"]:not(.__pollDetailed)';
      const pollBlockSelector = '[data-attribution="poll-block"]';
      const voteSelector = `button${keyToCss('vote')}:not(.__pollResultsShown)`;

      const newNodes = [];
      const target = document.getElementById('root');

      const styleElement = $str(`
        <style id='__s'>
          .__percentage {
            display: none;
            position: absolute;
            content: "";
            height: 100%;
            top: 0;
            left: 0;
            background: rgba(var(--blue),.2);
            border-radius: 0;
          }

          @media (prefers-reduced-motion: no-preference) {
            .__percentage {
              animation: 1s cubic-bezier(.8,0,.3,1) a9eBs;
              display: none;
            }
          }
          
          .__pollResultsShown button {
            overflow: hidden;
          }

          .__pollResultsShown button .__percentage {
            display: inline;
          }

          .seeResultsButton {
            border: 2px solid RGB(var(--deprecated-accent));
            border-radius: 18px;
            margin-bottom: 0;
            min-height: 36px;
            padding: 0 15px;
            width: max-content;
          }
          .seeResultsButton:hover {
            background-color: RGB(var(--deprecated-accent));
          }

          .seeResultsText {
            color: RGB(var(--deprecated-accent));
            padding: 7px 0;
            font-weight: 700;
            min-height: 36px;
            display: inline;
          }
          .seeResultsText:hover {
            color: RGB(var(--black));
          }
        </style>
      `);

      const fetchPercentage = obj => {
        const fiberKey = Object.keys(obj).find(key => key.startsWith('__reactFiber'));
        let fiber = obj[fiberKey];

        while (fiber !== null) {
          const { percentage } = fiber.memoizedProps || {};
          if (percentage !== undefined) {
            return percentage;
          } else {
            fiber = fiber.return;
          }
        }
      };

      const clearItems = answers => {
        for (const answer of answers) {
          if (answer.classList.contains('__pollDetailed')) continue;
          const pollBlock = answer.closest(pollBlockSelector);
          var item = pollBlock.querySelector('.seeResultsButton')
          if (item !== null) item.remove();
        }
      };
      const fetchPollResults = obj => {
        const fiberKey = Object.keys(obj).find(key => key.startsWith('__reactFiber'));
        let fiber = obj[fiberKey];

        while (fiber !== null) {
          const { percentage, answer } = fiber.memoizedProps || {};
          if (percentage !== undefined && answer !== undefined) {
            return `${percentage}%`;
          } else {
            fiber = fiber.return;
          }
        }
      }
      const pollResults = buttons => {
        for (const button of buttons) {
          const percentage = $str('<div class="__percentage"></div>');

          button.prepend(percentage);
          percentage.style.width = fetchPollResults(button);
        }
      }

      const addButton = poll => {
        let elem = document.createElement('button');
        elem.classList = "seeResultsButton"
        let buttonText = document.createElement('span');
        buttonText.classList = 'seeResultsText'
        buttonText.innerHTML = "See Results";
        elem.append(buttonText);
        return elem
      }

      const pollButtonFunc = button => {
        const poll = button.parentNode;
        poll.classList.add('__pollResultsShown');
      }

      const pollButton = polls => {
        for (const poll of polls) {
          if (poll.querySelector('.__pollDetailed') !== null) continue;
          let seeResultButton = addButton(poll)
          seeResultButton = poll.insertBefore(seeResultButton, poll.lastChild)
          seeResultButton.addEventListener('click', function(){pollButtonFunc(seeResultButton)});
        }
      }

      const mutationManager = Object.freeze({
        listeners: new Map(),
        start (func, selector) {
          if (this.listeners.has(func)) this.stop(func);
          this.listeners.set(func, selector);
          func(Array.from($a(selector)));
        },
        stop (func) { this.listeners.delete(func); },
      });
      const sortNodes = () => {
        const nodes = newNodes.splice(0);
        if (nodes.length === 0) return;
        for (const [func, selector] of mutationManager.listeners) {
          const matchingElements = [
            ...nodes.filter(node => node.matches(selector)),
            ...nodes.flatMap(node => [...node.querySelectorAll(selector)])
          ].filter((value, index, array) => index === array.indexOf(value));
          if (matchingElements.length) func(matchingElements);
        }
      };
      const observer = new MutationObserver(mutations => {
        const nodes = mutations
          .flatMap(({ addedNodes }) => [...addedNodes])
          .filter(node => node instanceof Element)
          .filter(node => node.isConnected);
        newNodes.push(...nodes);
        sortNodes();
      });

      const initialChecks = () => {
        if ($a('.__pollResultsShown').length) { // initial status checks to determine whether to inject or not
          console.log('poll buttons already there');
          return false;
        } else {
          console.log('adding poll buttons...');
          return true;
        }
      };
      const startMutationManagers = () => {
        mutationManager.start(clearItems, answerSelector);
        mutationManager.start(pollButton, pollBlockSelector);
        mutationManager.start(pollResults, voteSelector);

        observer.observe(target, { childList: true, subtree: true });
      };

      const showpolls = async function () {
        if (!initialChecks()) return;
        document.head.appendChild(styleElement);

        startMutationManagers()
        console.log('added poll buttons');
      };

      showpolls();

      window.tumblr.on('navigation', () => window.setTimeout(() => {
        showpolls().then(() => {
          window.setTimeout(() => {
            if (!$a('.__pollResultsShown').length) showpolls();
          }, 400);
        }).catch(() =>
          window.setTimeout(showpolls, 400)
        );
      }, 400
      ));
    });
  });
};
const getNonce = () => {
  const { nonce } = [...document.scripts].find(script => script.nonce) || '';
  if (nonce === '') console.error('empty script nonce attribute: script may not inject');
  return nonce;
};
const script = () => $( `
  <script id="__u" nonce="${getNonce()}">
    const unfuckDashboard = ${main.toString()};
    unfuckDashboard("${getNonce()}");
  </script>
` );
if ($( 'head' ).length === 0) {
  const newNodes = [];
  const findHead = () => {
    const nodes = newNodes.splice(0);
    if (nodes.length !== 0 && (nodes.some(node => node.matches('head') || node.querySelector('head') !== null))) {
      const head = nodes.find(node => node.matches('head'));
      $( head ).append(script());
    }
  };
  const observer = new MutationObserver(mutations => {
    const nodes = mutations
      .flatMap(({ addedNodes }) => [...addedNodes])
      .filter(node => node instanceof Element)
      .filter(node => node.isConnected);
    newNodes.push(...nodes);
    findHead();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
} else $( document.head ).append(script());
