import Adapt from 'core/js/adapt';
import React, { useCallback, useEffect, useState } from 'react';
import { compile } from 'core/js/reactHelpers';
export default function CourseNotes(props) {

  const courseId = Adapt.course?.get('_id') || 'defaultCourse';
  const localStorageKey = `adaptCourseNotes:${courseId}`;
  const { displayTitle, instruction, placeholder } = props;
  const globals = Adapt.course.get('_globals');
  const extensionGlobals = globals?._extensions?._courseNotes;
  const downloadButtonText = extensionGlobals?.downloadButtonText || 'Download notes';
  const courseTitle = Adapt.course.get('title');
  const answersStorageKey = `adaptCourseNotesAnswers:${courseId}`;
  const answersSectionTitle = extensionGlobals?.answersSectionTitle || 'Captured Answers';

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

  const addSectionDivider = (children, ParagraphCtor, TextRunCtor) => {
    children.push(new ParagraphCtor({
      children: [new TextRunCtor('----------------------------------------')],
      spacing: { before: 120, after: 120 }
    }));
  };

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

  const downloadNotes = async () => {
    try {
      const docxLib = window.docx;
      if (!docxLib) {
        downloadTxtFallback();
        return;
      }
      const { Document, HeadingLevel, Packer, Paragraph, TextRun } = docxLib;
      const children = [];

      if (displayTitle) {
        children.push(new Paragraph({
          text: stripHtml(compile(displayTitle, props)),
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 200 }
        }));
      }

      if (instruction) {
        children.push(new Paragraph({
          children: [new TextRun(stripHtml(compile(instruction, props)))],
          spacing: { after: 200 }
        }));
      }

      addSectionDivider(children, Paragraph, TextRun);

      children.push(new Paragraph({
        text: 'My Notes',
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 160 }
      }));

      const noteLines = valueTextArea.split(/\r?\n/);
      noteLines.forEach((line) => {
        if (!line.trim()) return;
        children.push(new Paragraph({
          children: [new TextRun(line)],
          spacing: { after: 80 }
        }));
      });

      if (capturedAnswers.length) {
        addSectionDivider(children, Paragraph, TextRun);
        children.push(new Paragraph({
          text: answersSectionTitle,
          heading: HeadingLevel.HEADING_2,
          spacing: { after: 160 }
        }));
        capturedAnswers.forEach((entry) => {
          const questionLine = entry.question ? `${entry.question}` : 'Learner answer';
          const formattedTimestamp = formatTimestamp(entry.timestamp);
          children.push(new Paragraph({
            children: [new TextRun({
              text: questionLine,
              bold: true
            })],
            spacing: { after: 40 }
          }));

          if (entry.questionBody) {
            children.push(new Paragraph({
              children: [new TextRun({
                text: stripHtml(entry.questionBody),
                italics: true
              })],
              spacing: { after: 40 }
            }));
          }

          children.push(new Paragraph({
            children: [new TextRun(`${entry.answer}`)],
            bullet: { level: 0 },
            spacing: { after: 80 }
          }));

          if (entry.pageTitle) {
            children.push(new Paragraph({
              children: [new TextRun({
                text: `Page: ${entry.pageTitle}`,
                italics: true
              })],
              spacing: { after: 120 }
            }));
          }

          if (formattedTimestamp) {
            children.push(new Paragraph({
              children: [new TextRun({
                text: `Submitted: ${formattedTimestamp}`,
                italics: true
              })],
              spacing: { after: 120 }
            }));
          }
        });
      }

      if (!children.length) {
        children.push(new Paragraph({
          text: 'Notes',
          heading: HeadingLevel.HEADING_1
        }));
        children.push(new Paragraph({
          children: [new TextRun('No notes available.')],
          spacing: { before: 120 }
        }));
      }

      const doc = new Document({
        creator: 'adapt-courseNotes',
        title: `${stripHtml(courseTitle || 'Course')} Notes`,
        description: 'Learner notes export',
        sections: [{
          properties: {},
          children
        }]
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const baseFileName = getBaseFileName();
      const configuredFileName = extensionGlobals?.downloadFileName;
      const outputFileName = configuredFileName
        ? (configuredFileName.endsWith('.docx') ? configuredFileName : `${configuredFileName}.docx`)
        : `${baseFileName}.docx`;
      link.download = outputFileName;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      // Keep export working even if docx generation fails in older environments.
      downloadTxtFallback();
    }
  };

  const downloadTxtFallback = () => {
    const blob = new Blob([valueTextArea], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `${getBaseFileName()}.txt`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
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
        </div>
      </div>
    </div>
  );
}
