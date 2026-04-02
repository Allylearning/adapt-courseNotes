import Adapt from 'core/js/adapt';
import location from 'core/js/location';
import Backbone from 'backbone';
import notify from 'core/js/notify';
import CourseNotesView from './CourseNotesView';
import CourseNotesNavView from './CourseNotesNavView';
class CourseNotes extends Backbone.Controller {
  initialize() {
    this.handleClick = this.handleClick.bind(this);
    this.handleAddAnswer = this.handleAddAnswer.bind(this);
    this.listenTo(Adapt, 'app:dataReady', this.onDataReady);
  }

  onDataReady() {
    if (!this.checkIsEnabled()) return;
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.listenTo(Adapt, {
      'adapt:initialize': this.onInitialize,
      'courseNotes:open': this.openCourseNotes,
      'courseNotes:addAnswer': this.handleAddAnswer,
      'pageView:ready': this.handlePageViewReady,
      'pageView:preRemove': this.handlePageViewPreRemove
    });
  }

  onInitialize() {
    this._isPopupOpen = false;
    const navView = new CourseNotesNavView({ model: new Backbone.Model(Adapt.course.get('_courseNotes')) });
    $('.nav__drawer-btn').after(navView.el);
  }

  openCourseNotes() {
    if (this._isPopupOpen) return;

    this._isPopupOpen = true;

    this.popupView = new CourseNotesView({ model: new Backbone.Model(Adapt.course.get('_courseNotes')) });

    notify.popup({
      _attributes: { 'data-adapt-id': 'coursenotes' },
      _view: this.popupView,
      _isCancellable: true,
      _showCloseButton: true,
      _classes: 'coursenotes'
    });

    this.listenToOnce(Adapt, {
      'popup:closed': this.closeCourseNotes
    });
  }

  closeCourseNotes() {
    this._isPopupOpen = false;
  }

  handleClick(event) {
    event && event.preventDefault();
    Adapt.trigger('courseNotes:open');
  }

  handlePageViewReady(view) {
    $('.js-coursenotes-click').on('click', this.handleClick);
  }

  handlePageViewPreRemove() {
    $('.js-coursenotes-click').off('click', this.handleClick);
  }

  getCourseId() {
    return Adapt.course?.get('_id') || 'defaultCourse';
  }

  getNotesScopeId() {
    const currentId = location?._currentId;
    if (!currentId) return `course:${this.getCourseId()}`;

    const currentModel = (typeof Adapt.findById === 'function') ? Adapt.findById(currentId) : null;
    let model = currentModel;
    let guard = 0;

    while (model && guard < 10) {
      const type = `${model.get('_type') || ''}`.toLowerCase();
      if (type === 'contentobject' || type === 'content-object') {
        return `contentobject:${model.get('_id') || currentId}`;
      }
      model = model.getParent ? model.getParent() : null;
      guard++;
    }

    return `page:${currentId}`;
  }

  getAnswersStorageKey(scopeId) {
    const resolvedScopeId = scopeId || this.getNotesScopeId();
    return `adaptCourseNotesAnswers:${this.getCourseId()}:${resolvedScopeId}`;
  }

  handleAddAnswer(payload) {
    const entry = (typeof payload === 'string')
      ? { answer: payload }
      : (payload || {});

    const answer = `${entry.answer || ''}`.trim();
    if (!answer) return;

    const answersStorageKey = this.getAnswersStorageKey(entry.scopeId);
    let existingEntries = [];
    try {
      existingEntries = JSON.parse(localStorage.getItem(answersStorageKey) || '[]');
      if (!Array.isArray(existingEntries)) existingEntries = [];
    } catch (error) {
      existingEntries = [];
    }

    const nextEntry = {
      question: entry.question || '',
      questionBody: entry.questionBody || '',
      answer,
      componentId: entry.componentId || '',
      pageTitle: entry.pageTitle || '',
      timestamp: new Date().toISOString()
    };

    const existingIndex = nextEntry.componentId
      ? existingEntries.findIndex(item => item.componentId === nextEntry.componentId)
      : -1;

    if (existingIndex >= 0) {
      existingEntries[existingIndex] = nextEntry;
    } else {
      existingEntries.push(nextEntry);
    }

    localStorage.setItem(answersStorageKey, JSON.stringify(existingEntries));
    Adapt.trigger('courseNotes:answersUpdated');
  }

  checkIsEnabled() {
    const _model = Adapt.course.get('_courseNotes');
    if (!_model || !_model._isEnabled) return false;
    return true;
  }
}
export default new CourseNotes();
