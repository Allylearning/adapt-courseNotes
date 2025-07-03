
import { templates } from 'core/js/reactHelpers';
import Adapt from 'core/js/adapt';
import React from 'react';
import ReactDOM from 'react-dom';
class CourseNotesNavView extends Backbone.View {
  tagName() {
    return 'button';
  }

  className() {
    return 'btn-icon nav__btn coursenotes__nav-btn';
  }

  attributes() {
    return {
      'aria-label': (Adapt.course.get('_globals')?._extensions?._courseNotes?.buttonNav || 'Open Course Notes')
    };
  }

  events() {
    return {
      click: 'onClick'
    };
  }

  initialize() {

    this.onClick = this.onClick.bind(this);
    this.render();
  }

  render() {
    const props = { ...this.model.toJSON() };
    const Template = templates[this.constructor.template.replace('.jsx', '')];
    ReactDOM.render(<Template {...props} />, this.el);
  }

  onClick(event) {
    if (event && event.preventDefault) event.preventDefault();
    Adapt.trigger('courseNotes:open');
  }
}
CourseNotesNavView.template = 'courseNotesNav';
export default CourseNotesNavView;
