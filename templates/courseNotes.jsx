import Adapt from 'core/js/adapt';
import React, { useCallback, useEffect, useState } from 'react';
import { compile } from 'core/js/reactHelpers';
export default function CourseNotes(props) {

  const getCourseStorageId = () => {
    const modelCourseId = Adapt.course?.get('_id');
    if (modelCourseId) return modelCourseId;

    const path = window.location?.pathname || '';
    if (path) return `path:${path}`;

    const title = Adapt.course?.get('title');
    if (title) return `title:${title}`;

    return 'course:unknown';
  };
  const courseStorageId = getCourseStorageId();
  const { displayTitle, instruction, placeholder } = props;
  const globals = Adapt.course.get('_globals');
  const extensionGlobals = globals?._extensions?._courseNotes;
  const downloadButtonText = extensionGlobals?.downloadButtonText || 'Download notes';
  const courseTitle = Adapt.course.get('title');
  const answersSectionTitle = extensionGlobals?.answersSectionTitle || 'Captured Answers';
  const localStorageKey = `adaptCourseNotes:${courseStorageId}`;
  const answersStorageKey = `adaptCourseNotesAnswers:${courseStorageId}`;

  const storage = localStorage.getItem(localStorageKey) || '';
  const [valueTextArea, setValueTextArea] = useState(storage);
  const [capturedAnswers, setCapturedAnswers] = useState([]);
  const [isSaved, setIsSaved] = useState(true);
  const [wasChanged, setWasChanged] = useState(false);
  const saveNotes = useCallback(
    _.debounce(valueTextArea => {
      localStorage.setItem(localStorageKey, valueTextArea);
      setIsSaved(true);
    }, 1000),
    []
  );

  useEffect(() => {
    return () => {
      saveNotes.cancel();
    };
  }, [saveNotes]);

  useEffect(() => {
    const readAnswers = () => {
      try {
        const entries = JSON.parse(localStorage.getItem(answersStorageKey) || '[]');
        setCapturedAnswers(Array.isArray(entries) ? entries : []);
      } catch (error) {
        setCapturedAnswers([]);
      }
    };

    readAnswers();
    Adapt.on('courseNotes:answersUpdated', readAnswers);
    return () => {
      Adapt.off('courseNotes:answersUpdated', readAnswers);
    };
  }, [answersStorageKey]);

  const handleChange = (event) => {
    setWasChanged(true);
    setIsSaved(false);
    setValueTextArea(event.target.value);
    saveNotes(event.target.value);
  };

  const stripHtml = (html) => {
    const div = document.createElement('div');
    div.innerHTML = html;
    return (div.textContent || div.innerText || '').trim();
  };

  const sanitizeFileName = (value) => {
    const sanitized = value
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '')
      .replace(/\s+/g, '_')
      .trim();
    return sanitized || 'Course';
  };

  const getBaseFileName = () => `${sanitizeFileName(stripHtml(courseTitle || 'Course'))}_Notes`;

  const formatTimestamp = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const parts = new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(date).reduce((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});

    return `${parts.day} ${parts.month} ${parts.year} ${parts.hour}:${parts.minute}`;
  };

  const downloadNotes = () => {
    downloadTxtFallback();
  };

  const downloadTxtFallback = () => {
    const lines = [];
    const compiledTitle = displayTitle ? stripHtml(compile(displayTitle, props)) : '';
    const compiledInstruction = instruction ? stripHtml(compile(instruction, props)) : '';

    if (compiledTitle) lines.push(compiledTitle);
    if (compiledInstruction) lines.push(compiledInstruction);
    if (compiledTitle || compiledInstruction) {
      lines.push('----------------------------------------');
    }

    lines.push('My Notes');
    lines.push('');
    if (valueTextArea.trim()) {
      lines.push(valueTextArea);
    } else {
      lines.push('No notes available.');
    }

    if (capturedAnswers.length) {
      lines.push('');
      lines.push('----------------------------------------');
      lines.push(answersSectionTitle);
      lines.push('');

      capturedAnswers.forEach((entry, index) => {
        const questionLine = entry.question || `Learner answer ${index + 1}`;
        const formattedTimestamp = formatTimestamp(entry.timestamp);

        lines.push(questionLine);
        if (entry.questionBody) lines.push(`Question body: ${stripHtml(entry.questionBody)}`);
        lines.push(`Answer: ${entry.answer || ''}`);
        if (entry.pageTitle) lines.push(`Page: ${entry.pageTitle}`);
        if (formattedTimestamp) lines.push(`Submitted: ${formattedTimestamp}`);
        lines.push('');
      });
    }

    const output = `${lines.join('\n')}\n`;
    const blob = new Blob([output], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `${getBaseFileName()}.txt`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const clearNotes = () => {
    const shouldClear = window.confirm('Clear all saved notes and captured answers?');
    if (!shouldClear) return;

    try {
      localStorage.removeItem(localStorageKey);
      localStorage.removeItem(answersStorageKey);
    } catch (error) {
      // Keep UI in sync even if storage operations fail silently.
    }

    setValueTextArea('');
    setCapturedAnswers([]);
    setWasChanged(false);
    setIsSaved(true);
    Adapt.trigger('courseNotes:answersUpdated');
  };

  return (
    <div className="coursenotes__header">
      {displayTitle &&
      <div className='coursenotes__title'>
        <div className='coursenotes__title-inner' dangerouslySetInnerHTML={{ __html: compile(displayTitle, props) }}>
        </div>
      </div>
      }

      {instruction &&
        <div className='coursenotes__instruction'>
          <div className='coursenotes__instruction-inner' dangerouslySetInnerHTML={{ __html: compile(instruction, props) }}>
          </div>
        </div>
      }
      <div className="coursenotes__widget">
        <textarea
          placeholder={placeholder}
          value={valueTextArea}
          onChange={handleChange}
        />
        {capturedAnswers.length > 0 &&
          <div className="coursenotes__answers">
            <div className="coursenotes__answers-title">{answersSectionTitle}</div>
            {capturedAnswers.map((entry, index) => (
              <div className="coursenotes__answer-item" key={entry.componentId || index}>
                <div className="coursenotes__answer-question">
                  {entry.question || `Answer ${index + 1}`}
                </div>
                {entry.questionBody &&
                  <div className="coursenotes__answer-body">
                    {stripHtml(entry.questionBody)}
                  </div>
                }
                <div className="coursenotes__answer-value">
                  {entry.answer}
                </div>
                {entry.pageTitle &&
                  <div className="coursenotes__answer-page">Page: {entry.pageTitle}</div>
                }
              </div>
            ))}
          </div>
        }
        <div className="coursenotes__controls">
          <div className={`coursenotes__status icon ${wasChanged ? (isSaved ? 'icon-tick' : 'icon-ellipsis') : ''}`}></div>
          <button className="coursenotes__download-btn btn-text" onClick={downloadNotes}>
            {downloadButtonText}
          </button>
          <button className="coursenotes__reset-btn btn-text" onClick={clearNotes}>
            Clear notes
          </button>
        </div>
      </div>
    </div>
  );
}
