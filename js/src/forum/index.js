import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import Discussion from 'flarum/common/models/Discussion';
import Tag from 'flarum/tags/models/Tag';
import Model from 'flarum/common/Model';
import IndexPage from 'flarum/forum/components/IndexPage';
import Dropdown from 'flarum/common/components/Dropdown';
import Button from 'flarum/common/components/Button';
import DiscussionListState from 'flarum/forum/states/DiscussionListState';
import DiscussionComposer from 'flarum/forum/components/DiscussionComposer';

import SelectBestAnswerNotification from './components/SelectBestAnswerNotification';
import addBestAnswerAction from './addBestAnswerAction';
import addBestAnswerView from './addBestAnswerView';
import addAnsweredBadge from './addAnsweredBadge';
import AwardedBestAnswerNotification from './components/AwardedBestAnswerNotification';
import BestAnswerInDiscussionNotification from './components/BestAnswerInDiscussionNotification';
import extendNotifications from './extend/extendNotifications';
import User from 'flarum/common/models/User';
import addBestAnswerCountToUsers from './addBestAnswerCountToUsers';

export * from './components';

app.initializers.add('fof/best-answer', () => {
  Discussion.prototype.bestAnswerPost = Model.hasOne('bestAnswerPost');
  Discussion.prototype.bestAnswerUser = Model.hasOne('bestAnswerUser');
  Discussion.prototype.hasBestAnswer = Model.attribute('hasBestAnswer');
  Discussion.prototype.canSelectBestAnswer = Model.attribute('canSelectBestAnswer');
  Discussion.prototype.bestAnswerSetAt = Model.attribute('bestAnswerSetAt', Model.transformDate);

  if (app.initializers.has('flarum-tags')) {
    Tag.prototype.isQnA = Model.attribute('isQnA');
  }

  app.notificationComponents.selectBestAnswer = SelectBestAnswerNotification;
  app.notificationComponents.awardedBestAnswer = AwardedBestAnswerNotification;
  app.notificationComponents.bestAnswerInDiscussion = BestAnswerInDiscussionNotification;

  addAnsweredBadge();
  addBestAnswerAction();
  addBestAnswerView();
  addBestAnswerCountToUsers();

  extendNotifications();

  extend(IndexPage.prototype, 'sidebarItems', function (items) {
    const tag = this.currentTag();

    if (!tag?.isQnA?.()) return;

    const canStartDiscussion = app.forum.attribute('canStartDiscussion') || !app.session.user;
    const cta = items.get('newDiscussion');
    cta.children = app.translator.trans(
      canStartDiscussion ? 'fof-best-answer.forum.index.ask_question' : 'fof-best-answer.forum.index.cannot_ask_question'
    );

    items.replace('startDiscussion', cta);
  });

  extend(IndexPage.prototype, 'viewItems', function (items) {
    if (!app.forum.attribute('showBestAnswerFilterUi')) {
      return;
    }

    const tag = this.currentTag();

    if (!tag?.isQnA?.()) {
      if (app.discussions.bestAnswer) {
        delete app.discussions.bestAnswer;
        app.discussions.refresh();
      }

      return;
    }

    const options = ['all', 'solved', 'unsolved'];

    const selected = app.discussions.bestAnswer;

    items.add(
      'solved-filter',
      Dropdown.component(
        {
          buttonClassName: 'Button',
          label: app.translator.trans(
            `fof-best-answer.forum.filter.${options[selected] || Object.keys(options).map((key) => options[key])[0]}_label`
          ),
          accessibleToggleLabel: app.translator.trans('fof-best-answer.forum.filter.accessible_label'),
        },
        Object.keys(options).map((value) => {
          const label = options[value];
          const active = (selected || Object.keys(options)[0]) === value;

          return Button.component(
            {
              icon: active ? 'fas fa-check' : true,
              active: active,
              onclick: () => {
                app.discussions.bestAnswer = value;
                if (value === '0') {
                  delete app.discussions.bestAnswer;
                }
                app.discussions.refresh();
              },
            },
            app.translator.trans(`fof-best-answer.forum.filter.${label}_label`)
          );
        })
      )
    );
  });

  extend(DiscussionListState.prototype, 'requestParams', function (params) {
    if (app.discussions.bestAnswer) {
      const negate = app.discussions.bestAnswer === '2';
      const prepend = negate ? '-' : '';

      params.filter[`${prepend}solved-discussions`] = true;

      if (params.filter.q) {
        params.filter.q += ` ${prepend}is:solved`;
      }
    }
  });

  extend(DiscussionComposer.prototype, 'headerItems', function (items) {
    const tags = this.composer.fields.tags;
    if (tags === undefined) return;

    const qna = tags.some((t) => t.isQnA());

    if (!qna) return;

    this.attrs.titlePlaceholder = app.translator.trans('fof-best-answer.forum.composer.titlePlaceholder');

    items.replace(
      'discussionTitle',
      <h3>
        <input
          className="FormControl"
          bidi={this.title}
          placeholder={this.attrs.titlePlaceholder}
          disabled={!!this.attrs.disabled}
          onkeydown={this.onkeydown.bind(this)}
        />
      </h3>
    );
  });
});
