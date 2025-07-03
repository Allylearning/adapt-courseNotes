import Adapt from 'core/js/adapt';
import Backbone from 'backbone';
import notify from 'core/js/notify';
import CourseNotesView from './CourseNotesView';
import CourseNotesNavView from './CourseNotesNavView';
class CourseNotes extends Backbone.Controller {
  initialize() {
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
    $('.js-coursenotes-click').on('click', this.handleClick.bind(this));
  }

  handlePageViewPreRemove() {
    $('.js-coursenotes-click').off('click', this.handleClick.bind(this));
  }

  checkIsEnabled() {
    const _model = Adapt.course.get('_courseNotes');
    if (!_model || !_model._isEnabled) return false;
    return true;
  }
}
export default new CourseNotes();
