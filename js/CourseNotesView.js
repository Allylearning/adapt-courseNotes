import Adapt from 'core/js/adapt';
import Backbone from 'backbone';
import { templates } from 'core/js/reactHelpers';
import React from 'react';
import ReactDOM from 'react-dom';
class CourseNotesView extends Backbone.View {

  className() { return 'coursenotes'; }

  initialize() {
    this.listenTo(Adapt, 'remove', this.remove);
    this.render();
  }

  render() {
    const props = { ...this.model.toJSON() };
    const Template = templates[this.constructor.template.replace('.jsx', '')];
    ReactDOM.render(<Template {...props} />, this.el);
    return this;
  }

}

CourseNotesView.template = 'courseNotes';

export default CourseNotesView;
