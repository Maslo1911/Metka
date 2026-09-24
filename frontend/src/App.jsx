import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { api, clearToken, getToken, setToken, setUnauthorizedHandler, toNote, toTag } from './api.js'

const PALETTE = {
  purple: { bg: '#f0e7ff', text: '#624a91', border: '#8060bd', dot: '#815ac3' },
  teal: { bg: '#dcf6f3', text: '#376b69', border: '#319a91', dot: '#279c91' },
  orange: { bg: '#ffebda', text: '#91613b', border: '#d78b48', dot: '#ef903b' },
  pink: { bg: '#fce5f1', text: '#98476e', border: '#d95094', dot: '#d23c85' },
  blue: { bg: '#deecff', text: '#486d95', border: '#5d98d5', dot: '#4c91dc' },
  green: { bg: '#e0f5df', text: '#4d7b4b', border: '#56a254', dot: '#43a34a' },
}

// Цвет тега хранится в БД строкой: либо ключ палитры ("purple"), либо hex ("#4ECDC4")
function colorOf(color) {
  if (PALETTE[color]) return PALETTE[color]
  if (/^#[0-9a-f]{6}$/i.test(color || '')) return { bg: `${color}33`, text: '#3a3f44', border: color, dot: color }
  return PALETTE.blue
}

function Icon({ name, size = 20, className = '' }) {
  const paths = {
    bookmark: <path d="M6 21V5a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v16l-6-4-6 4Z" />,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    arrow: <path d="m15 18-6-6 6-6M9 12h12" />,
    tag: <><path d="M3 11V5a2 2 0 0 1 2-2h6l10 10a2 2 0 0 1 0 3l-5 5a2 2 0 0 1-3 0L3 11Z" /><circle cx="7.5" cy="7.5" r="1" /></>,
    check: <path d="m4 12 5 5L20 6" />,
    trash: <><path d="M4 7h16M10 3h4M6 7l1 14h10l1-14M10 11v6M14 11v6" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    palette: <><path d="M12 3a9 9 0 1 0 0 18h1.5a2 2 0 0 0 1.4-3.4 1.7 1.7 0 0 1 1.2-2.9H18A3 3 0 0 0 21 12a9 9 0 0 0-9-9Z" /><circle cx="7.5" cy="11" r=".6" /><circle cx="10" cy="7" r=".6" /><circle cx="15" cy="7.5" r=".6" /></>,
    edit: <><path d="M12 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" /><path d="m10 14 9-9 2 2-9 9-3 1 1-3ZM17 7l2 2" /></>,
    eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" /><circle cx="12" cy="12" r="2.5" /></>,
    eyeOff: <><path d="m3 3 18 18M9.5 6.3A12 12 0 0 1 12 6c6.5 0 10 6 10 6a16 16 0 0 1-3.3 3.8M6 8C3.4 9.7 2 12 2 12s3.5 6 10 6c1.5 0 2.8-.3 4-.8" /></>,
    x: <path d="M5 5 19 19M19 5 5 19" />,
  }
  return <svg aria-hidden="true" className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}

function Logo({ centered = false }) {
  return <span className={`inline-flex items-center gap-3 font-bold tracking-tight text-[#202020] ${centered ? 'text-[29px]' : 'text-[25px]'}`}><Icon name="bookmark" size={29} className="text-[#3f80d4]" />Metka</span>
}

function TagBadge({ tag, onClick, onRemove, selected = false, outline = false }) {
  if (!tag) return null
  const color = colorOf(tag.color)
  const style = {
    backgroundColor: outline && !selected ? '#fff' : color.bg,
    color: outline && !selected ? '#64686d' : color.text,
    borderColor: selected ? color.border : outline ? '#e3e5e8' : 'transparent',
  }
  const className = `inline-flex shrink-0 items-center justify-center gap-2 rounded-full border px-3 py-1.5 text-sm leading-5 transition hover:brightness-[.97] ${selected ? 'border-[1.5px]' : ''}`
  if (onRemove) return <span className={className} style={style}>{tag.name}<button type="button" aria-label={`Убрать тег ${tag.name}`} onClick={onRemove} className="ml-1 inline-flex rounded-full hover:opacity-60"><Icon name="x" size={14} /></button></span>
  if (onClick) return <button type="button" className={className} style={style} onClick={onClick}>{tag.name}{selected && <Icon name="check" size={15} />}</button>
  return <span className={className} style={style}>{tag.name}</span>
}

function BackBar({ navigate, children }) {
  return <header className="flex min-h-[78px] items-center justify-between gap-4 border-b border-[#ededed] px-5 sm:px-9"><button type="button" onClick={() => navigate('/')} className="inline-flex items-center gap-3 text-[15px] text-[#666a6e] hover:text-[#242424]"><Icon name="arrow" size={19} />Все заметки</button>{children}</header>
}

function Home({ notes, tags, user, navigate, onLogout }) {
  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState('all')
  const [profileOpen, setProfileOpen] = useState(false)
  const initials = (user?.name || user?.login || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase()
  const shown = useMemo(() => notes.filter(note => {
    const matchesTag = activeTag === 'all' || note.tagId === activeTag
    const matchesQuery = `${note.title} ${note.body}`.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru'))
    return matchesTag && matchesQuery
  }), [notes, activeTag, query])

  return <>
    <header className="border-b border-[#e9e9e9] bg-white">
      <div className="flex min-h-[78px] flex-wrap items-center gap-4 px-5 py-3 sm:px-9 lg:flex-nowrap lg:gap-7">
        <button type="button" onClick={() => { setActiveTag('all'); setQuery('') }} aria-label="Metka — все заметки" className="mr-auto lg:mr-0 lg:w-[168px] text-left"><Logo /></button>
        <label className="relative order-3 w-full lg:order-none lg:flex-1"><Icon name="search" size={21} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9ba1a5]" /><span className="sr-only">Поиск по тексту заметок</span><input value={query} onChange={event => setQuery(event.target.value)} type="search" placeholder="Поиск по тексту заметок" className="field-focus h-11 w-full rounded-[10px] border border-[#e1e3e5] bg-white pl-12 pr-4 text-[15px] outline-none placeholder:text-[#9b9da1]" /></label>
        <button type="button" onClick={() => navigate('/notes/new')} className="inline-flex h-11 items-center gap-2 rounded-[9px] bg-[#1c1c1c] px-5 text-[15px] text-white hover:bg-[#343434]"><Icon name="plus" size={20} />Новая заметка</button>
        <div className="relative"><button type="button" aria-label="Профиль" onClick={() => setProfileOpen(value => !value)} className="grid h-10 w-10 place-items-center rounded-full bg-[#deebff] text-[13px] font-bold text-[#4277b7]">{initials}</button>{profileOpen && <div className="absolute right-0 top-12 z-20 min-w-44 rounded-xl border border-[#e8e8e8] bg-white p-2 shadow-lg"><div className="px-3 py-2 text-sm"><div className="font-semibold">{user?.name}</div><div className="text-[#8a8e92]">@{user?.login}</div></div><button type="button" onClick={onLogout} className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[#f5f6f7]">Выйти</button></div>}</div>
      </div>
    </header>
    <main className="px-5 pb-12 sm:px-9">
      <nav aria-label="Фильтр по тегам" className="mb-10 mt-8 flex flex-wrap items-center gap-2"><span className="mr-4 text-[15px] text-[#6b6e71]">Теги</span><button type="button" onClick={() => setActiveTag('all')} className={`rounded-full px-5 py-2 text-sm ${activeTag === 'all' ? 'bg-[#202020] text-white' : 'border border-[#e4e5e6] bg-white text-[#555]'}`}>Все · {notes.length}</button>{tags.map(tag => <button key={tag.id} type="button" onClick={() => setActiveTag(tag.id)} className="rounded-full px-5 py-2 text-sm transition hover:brightness-[.97]" style={{ backgroundColor: activeTag === tag.id ? colorOf(tag.color).dot : colorOf(tag.color).bg, color: activeTag === tag.id ? '#fff' : colorOf(tag.color).text }}>{tag.name}</button>)}<button type="button" onClick={() => navigate('/tags')} className="ml-1 inline-flex items-center gap-2 rounded-full border border-dashed border-[#d6d8da] px-4 py-2 text-sm text-[#72777a] hover:bg-[#fafafa]"><Icon name="tag" size={16} />Управление</button></nav>
      {shown.length ? <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{shown.map(note => <button key={note.id} type="button" onClick={() => navigate(`/notes/${note.id}`)} className="group flex min-h-[196px] flex-col rounded-[14px] border border-[#e3e3e3] bg-white p-6 text-left shadow-[0_3px_9px_rgba(0,0,0,.025)] transition hover:border-[#c6d4e6] hover:shadow-[0_8px_20px_rgba(0,0,0,.06)]"><h2 className="mb-3 line-clamp-2 text-[20px] font-bold leading-6 text-[#202020]">{note.title}</h2><p className="line-clamp-2 text-[15.5px] leading-[1.45] text-[#73777b]">{note.body.replace(/\n+/g, ' ')}</p><div className="mt-auto flex items-end justify-between gap-3 pt-5"><div className="flex flex-wrap gap-1.5">{note.tagId != null && <TagBadge tag={tags.find(tag => tag.id === note.tagId)} />}</div><time dateTime={note.date} className="shrink-0 pb-1 text-[13px] text-[#9a9da1]">{shortDate(note.date)}</time></div></button>)}</div> : <div className="mx-auto mt-24 max-w-md text-center"><p className="text-xl font-semibold">Ничего не найдено</p><p className="mt-2 text-[#777]">Попробуйте изменить запрос или выбрать другой тег.</p><button type="button" onClick={() => { setQuery(''); setActiveTag('all') }} className="mt-5 rounded-lg border border-[#ddd] px-5 py-2 text-sm">Сбросить фильтры</button></div>}
    </main>
  </>
}

function shortDate(date) {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(new Date(date))
}

function fullDate(date) {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date))
}

function TagCreateDialog({ onClose, onCreate }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('orange')
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/25 p-4" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><form onSubmit={event => { event.preventDefault(); if (name.trim()) { onCreate(name.trim(), color); onClose() } }} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"><div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-bold">Новый тег</h2><button type="button" aria-label="Закрыть" onClick={onClose}><Icon name="x" /></button></div><label className="block text-sm text-[#696d70]">Название<input autoFocus value={name} onChange={event => setName(event.target.value)} maxLength={24} placeholder="Например, Путешествия" className="field-focus mt-2 h-11 w-full rounded-lg border border-[#dedfe2] px-3.5 outline-none" /></label><div className="mt-5 flex gap-3" aria-label="Цвет тега">{Object.entries(PALETTE).map(([key, value]) => <button key={key} type="button" aria-label={`Цвет ${key}`} aria-pressed={color === key} onClick={() => setColor(key)} className={`h-7 w-7 rounded-full border-[3px] border-white ${color === key ? 'ring-2 ring-[#4d5459]' : ''}`} style={{ backgroundColor: value.dot }} />)}</div><div className="mt-7 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-lg border border-[#ddd] px-4 py-2">Отмена</button><button type="submit" disabled={!name.trim()} className="rounded-lg bg-[#1c1c1c] px-5 py-2 text-white disabled:opacity-40">Создать тег</button></div></form></div>
}

function NoteEditor({ note, tags, navigate, saveNote, deleteNote, createTag }) {
  const isNew = !note
  const [title, setTitle] = useState(note?.title || '')
  const [body, setBody] = useState(note?.body || '')
  const [selectedTags, setSelectedTags] = useState(note?.tagId != null ? [note.tagId] : [])
  const [tagPickerOpen, setTagPickerOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(true)
  const [saving, setSaving] = useState(false)
  // в БД у заметки один тег (note.tag_id), поэтому выбор одиночный
  const toggleTag = id => { setSelectedTags(current => current.includes(id) ? [] : [id]); setSaved(false) }
  const handleSave = async event => {
    event?.preventDefault()
    if (saving) return
    if (!title.trim()) { setError('Введите название заметки'); return }
    setSaving(true)
    const ok = await saveNote({ id: note?.id, title: title.trim(), body: body.trim(), tagId: selectedTags[0] ?? null })
    setSaving(false)
    if (ok) { setSaved(true); navigate('/') }
  }
  const addTag = async (name, color) => {
    const id = await createTag(name, color)
    if (id != null) { setSelectedTags([id]); setSaved(false) }
  }

  if (isNew) return <>
    <BackBar navigate={navigate} />
    <main className="px-4 pb-12 pt-7"><form onSubmit={handleSave} className="mx-auto max-w-[712px] rounded-[15px] border border-[#e3e3e3] bg-white p-6 shadow-[0_3px_9px_rgba(0,0,0,.025)] sm:p-12"><h1 className="mb-8 text-[30px] font-bold tracking-tight">Новая заметка</h1><label className="block text-[13px] text-[#6b6e71]">Название<input value={title} onChange={event => { setTitle(event.target.value); setSaved(false); setError('') }} placeholder="Например, Конспект по базам данных" className="field-focus mt-2 h-12 w-full rounded-[9px] border border-[#dedfe2] px-4 text-[15px] text-[#242424] outline-none placeholder:text-[#a0a1a4]" /></label>{error && <p className="mt-1 text-sm text-red-600">{error}</p>}<label className="mt-6 block text-[13px] text-[#6b6e71]">Текст заметки<textarea value={body} onChange={event => { setBody(event.target.value); setSaved(false) }} placeholder="Начните писать..." className="field-focus mt-2 h-[215px] w-full rounded-[9px] border border-[#dedfe2] px-4 py-3.5 text-[15px] leading-6 text-[#242424] outline-none placeholder:text-[#a0a1a4]" /></label><div className="mt-5"><span className="block text-[13px] text-[#6b6e71]">Теги</span><div className="mt-2 flex flex-wrap items-center gap-2">{tags.map(tag => <TagBadge key={tag.id} tag={tag} outline selected={selectedTags.includes(tag.id)} onClick={() => toggleTag(tag.id)} />)}<button type="button" onClick={() => setCreateOpen(true)} className="inline-flex items-center gap-1 rounded-full border border-dashed border-[#d3d5d8] px-4 py-1.5 text-sm text-[#717579]"><Icon name="plus" size={16} />Новый тег</button></div></div><div className="mt-9 flex flex-wrap gap-3"><button type="submit" disabled={saving} className="min-w-[142px] rounded-[9px] bg-[#1c1c1c] px-6 py-3 text-[15px] text-white hover:bg-[#333] disabled:opacity-50">{saving ? 'Сохранение…' : 'Сохранить'}</button><button type="button" onClick={() => navigate('/')} className="min-w-[125px] rounded-[9px] border border-[#e2e3e5] px-6 py-3 text-[15px] hover:bg-[#fafafa]">Отмена</button></div></form></main>{createOpen && <TagCreateDialog onClose={() => setCreateOpen(false)} onCreate={addTag} />}
  </>

  return <>
    <BackBar navigate={navigate}><div className="flex items-center gap-3"><button type="button" aria-label="Удалить заметку" title="Удалить заметку" onClick={async () => { if (window.confirm('Удалить эту заметку?') && await deleteNote(note.id)) navigate('/') }} className="icon-button h-11 w-11 border border-[#e1e3e5] text-[#555b60] hover:bg-[#fafafa]"><Icon name="trash" size={20} /></button><button type="button" onClick={handleSave} disabled={saving} className="inline-flex h-11 min-w-[200px] items-center justify-center gap-2 rounded-[9px] bg-[#1c1c1c] px-5 text-[15px] text-white hover:bg-[#333] disabled:opacity-50"><Icon name="check" size={20} />{saving ? 'Сохранение…' : 'Сохранить'}</button></div></BackBar>
    <main className="px-4 pb-6"><div className="mx-auto -mt-2 flex min-h-[785px] max-w-[890px] flex-col rounded-[15px] border border-[#e4e4e4] bg-white shadow-[0_3px_9px_rgba(0,0,0,.025)]"><div className="flex-1 px-6 pt-10 sm:px-12"><input aria-label="Название заметки" value={title} onChange={event => { setTitle(event.target.value); setSaved(false); setError('') }} className="w-full border-0 bg-transparent text-[28px] font-bold leading-tight outline-none placeholder:text-[#999] sm:text-[36px]" placeholder="Название заметки" />{error && <p className="mt-1 text-sm text-red-600">{error}</p>}<div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[14px] text-[#777b7e]"><span className="inline-flex items-center gap-2"><Icon name="calendar" size={16} />Создана {fullDate(note.date)}</span></div><div className="mt-7 flex min-h-[80px] flex-wrap items-center gap-2 border-y border-[#ececec] py-4"><span className="mr-3 text-sm text-[#777]">Теги</span>{selectedTags.map(id => <TagBadge key={id} tag={tags.find(tag => tag.id === id)} onRemove={() => toggleTag(id)} />)}<div className="relative"><button type="button" onClick={() => setTagPickerOpen(value => !value)} className="inline-flex items-center gap-1 rounded-full border border-dashed border-[#d4d6d8] px-4 py-1.5 text-sm text-[#777]"><Icon name="plus" size={16} />{selectedTags.length ? 'Сменить тег' : 'Добавить тег'}</button>{tagPickerOpen && <div className="absolute left-0 top-11 z-10 min-w-44 rounded-xl border border-[#e5e5e5] bg-white p-2 shadow-lg">{tags.filter(tag => !selectedTags.includes(tag.id)).map(tag => <button key={tag.id} type="button" onClick={() => { toggleTag(tag.id); setTagPickerOpen(false) }} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-[#f7f7f7]">{tag.name}</button>)}<button type="button" onClick={() => { setCreateOpen(true); setTagPickerOpen(false) }} className="block w-full rounded-lg px-3 py-2 text-left text-[#427ec5] hover:bg-[#f7f7f7]">+ Новый тег</button></div>}</div></div><textarea aria-label="Текст заметки" value={body} onChange={event => { setBody(event.target.value); setSaved(false) }} placeholder="Начните писать..." className="mt-5 min-h-[430px] w-full resize-none border-0 bg-transparent text-[18px] leading-[1.8] text-[#252525] outline-none placeholder:text-[#aaa]" /></div><footer className="flex items-center justify-between gap-3 border-t border-[#ececec] px-6 py-4 text-[13px] text-[#9a9da0] sm:px-12"><span>{saved ? 'Все изменения сохранены' : 'Есть несохранённые изменения'}</span><span>{body.length} символов</span></footer></div></main>{createOpen && <TagCreateDialog onClose={() => setCreateOpen(false)} onCreate={addTag} />}
  </>
}

function TagManager({ tags, notes, navigate, createTag, updateTag, deleteTag }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('orange')
  const [editing, setEditing] = useState(null)
  const [editName, setEditName] = useState('')
  const [colorPicker, setColorPicker] = useState(null)
  const counts = Object.fromEntries(tags.map(tag => [tag.id, notes.filter(note => note.tagId === tag.id).length]))
  return <><BackBar navigate={navigate} /><main className="mx-auto max-w-[1000px] px-4 pb-12 pt-12 sm:px-5"><h1 className="mb-8 text-[21px] font-bold">Управление тегами</h1><form onSubmit={async event => { event.preventDefault(); if (name.trim()) { const id = await createTag(name.trim(), color); if (id != null) setName('') } }} className="rounded-[15px] border border-[#e3e3e3] bg-white p-6 shadow-[0_3px_9px_rgba(0,0,0,.025)]"><label className="block text-[13px] text-[#6e7275]">Новый тег</label><div className="mt-3 flex flex-wrap items-center gap-5"><input value={name} onChange={event => setName(event.target.value)} maxLength={24} placeholder="Например, Путешествия" className="field-focus h-11 min-w-[220px] flex-1 rounded-[9px] border border-[#dedfe2] px-4 text-[15px] outline-none placeholder:text-[#a0a2a5]" /><div className="flex items-center gap-2.5" aria-label="Цвет нового тега">{Object.entries(PALETTE).map(([key, value]) => <button key={key} type="button" aria-label={`Цвет ${key}`} aria-pressed={color === key} onClick={() => setColor(key)} className={`h-7 w-7 rounded-full border-[3px] border-white ${color === key ? 'ring-2 ring-[#4d5459]' : ''}`} style={{ backgroundColor: value.dot }} />)}</div><button type="submit" disabled={!name.trim()} className="h-11 rounded-[9px] bg-[#1c1c1c] px-6 text-[15px] text-white hover:bg-[#333] disabled:opacity-40">Создать тег</button></div></form><div className="mt-6 overflow-hidden rounded-[15px] border border-[#e3e3e3] bg-white shadow-[0_3px_9px_rgba(0,0,0,.025)]"><div className="grid grid-cols-[minmax(0,1fr)_90px_120px] items-center border-b border-[#ececec] px-6 py-4 text-[13px] text-[#777b7e] sm:grid-cols-[minmax(0,1fr)_180px_120px]"><span>Тег</span><span>Заметок</span><span className="text-right">Действия</span></div>{tags.map(tag => <div key={tag.id} className="grid min-h-[64px] grid-cols-[minmax(0,1fr)_90px_120px] items-center border-b border-[#ececec] px-6 py-2 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_180px_120px]"><div>{editing === tag.id ? <form onSubmit={event => { event.preventDefault(); if (editName.trim()) { updateTag(tag.id, { name: editName.trim() }); setEditing(null) } }} className="flex max-w-72 items-center gap-1"><input autoFocus value={editName} onChange={event => setEditName(event.target.value)} maxLength={24} className="field-focus min-w-0 flex-1 rounded-lg border border-[#dcdfe2] px-2 py-1 outline-none" /><button type="submit" aria-label="Сохранить название" className="p-1 text-[#56854e]"><Icon name="check" size={18} /></button></form> : <TagBadge tag={tag} />}</div><span className="text-[15px] text-[#444]">{counts[tag.id]}</span><div className="flex items-center justify-end gap-3 text-[#74797d]"><div className="relative"><button type="button" title="Изменить цвет" aria-label={`Изменить цвет тега ${tag.name}`} onClick={() => setColorPicker(colorPicker === tag.id ? null : tag.id)} className="icon-button h-7 w-7 hover:bg-[#f4f4f4]"><Icon name="palette" size={18} /></button>{colorPicker === tag.id && <div className="absolute right-0 top-8 z-10 flex gap-1 rounded-lg border border-[#ddd] bg-white p-2 shadow-lg">{Object.entries(PALETTE).map(([key, value]) => <button key={key} type="button" aria-label={`Выбрать цвет ${key}`} onClick={() => { updateTag(tag.id, { color: key }); setColorPicker(null) }} className="h-6 w-6 rounded-full" style={{ backgroundColor: value.dot }} />)}</div>}</div><button type="button" title="Переименовать" aria-label={`Переименовать тег ${tag.name}`} onClick={() => { setEditing(tag.id); setEditName(tag.name) }} className="icon-button h-7 w-7 hover:bg-[#f4f4f4]"><Icon name="edit" size={18} /></button><button type="button" title="Удалить" aria-label={`Удалить тег ${tag.name}`} onClick={() => { if (window.confirm(`Удалить тег «${tag.name}»? Он исчезнет из заметок.`)) deleteTag(tag.id) }} className="icon-button h-7 w-7 hover:bg-[#f4f4f4]"><Icon name="trash" size={18} /></button></div></div>)}</div></main></>
}

function Auth({ onAuthed }) {
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const switchMode = next => { setMode(next); setError('') }
  const submit = async event => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (mode === 'register') await api.register({ name: name.trim(), login: login.trim(), password })
      const { access_token } = await api.login(login.trim(), password)
      setToken(access_token)
      onAuthed()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }
  const inputClass = 'field-focus mt-2 h-12 w-full rounded-[9px] border border-[#dedfe2] px-4 text-[15px] outline-none placeholder:text-[#a0a2a5]'
  return <main className="grid min-h-screen place-items-center bg-white p-5"><form onSubmit={submit} className="w-full max-w-[426px] rounded-[15px] border border-[#e4e4e4] bg-white px-7 pb-12 pt-10 shadow-[0_3px_10px_rgba(0,0,0,.035)] sm:px-10"><div className="text-center"><Logo centered /><p className="mt-2 text-[14px] text-[#777b7f]">Заметки с тегами</p></div><div className="mt-8 flex rounded-[9px] bg-[#f7f7f7] p-1"><button type="button" onClick={() => switchMode('login')} className={`h-9 flex-1 rounded-[7px] text-[14px] ${mode === 'login' ? 'bg-white font-semibold shadow-[0_1px_5px_rgba(0,0,0,.12)]' : 'text-[#808387]'}`}>Вход</button><button type="button" onClick={() => switchMode('register')} className={`h-9 flex-1 rounded-[7px] text-[14px] ${mode === 'register' ? 'bg-white font-semibold shadow-[0_1px_5px_rgba(0,0,0,.12)]' : 'text-[#808387]'}`}>Регистрация</button></div>{mode === 'register' && <label className="mt-7 block text-[13px] text-[#73777a]">Имя<input required maxLength={100} autoComplete="name" value={name} onChange={event => setName(event.target.value)} placeholder="Иван Петров" className={inputClass} /></label>}<label className={`${mode === 'register' ? 'mt-5' : 'mt-7'} block text-[13px] text-[#73777a]`}>Логин<input required minLength={3} maxLength={50} autoComplete="username" value={login} onChange={event => setLogin(event.target.value)} placeholder="ivan" className={inputClass} /></label><label className="mt-5 block text-[13px] text-[#73777a]">Пароль<span className="relative mt-2 block"><input required minLength={6} maxLength={100} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} placeholder="••••••••" className="field-focus h-12 w-full rounded-[9px] border border-[#dedfe2] px-4 pr-12 text-[15px] outline-none placeholder:text-[#a0a2a5]" /><button type="button" aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'} onClick={() => setShowPassword(value => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#96999b]"><Icon name={showPassword ? 'eyeOff' : 'eye'} size={19} /></button></span></label>{error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}<button type="submit" disabled={busy} className="mt-8 h-11 w-full rounded-[9px] bg-[#1c1c1c] text-[15px] text-white hover:bg-[#333] disabled:opacity-50">{busy ? 'Подождите…' : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}</button><p className="mt-8 text-center text-[14px] text-[#777b7e]">{mode === 'login' ? 'Нет аккаунта?' : 'Уже есть аккаунт?'} <button type="button" onClick={() => switchMode(mode === 'login' ? 'register' : 'login')} className="ml-1 text-[#4480c9] hover:underline">{mode === 'login' ? 'Зарегистрироваться' : 'Войти'}</button></p></form></main>
}

export default function App() {
  // guest — нет токена, loading — грузим данные, ready — всё загружено, error — сервер недоступен
  const [session, setSession] = useState(() => (getToken() ? 'loading' : 'guest'))
  const [loadError, setLoadError] = useState('')
  const [user, setUser] = useState(null)
  const [notes, setNotes] = useState([])
  const [tags, setTags] = useState([])
  const [path, setPath] = useState(window.location.pathname)
  const [toast, setToast] = useState('')

  const resetData = () => { setUser(null); setNotes([]); setTags([]) }

  useEffect(() => { setUnauthorizedHandler(() => { resetData(); setSession('guest') }) }, [])
  useEffect(() => { const onPop = () => setPath(window.location.pathname); window.addEventListener('popstate', onPop); return () => window.removeEventListener('popstate', onPop) }, [])
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 4500); return () => clearTimeout(timer) }, [toast])

  const loadAll = useCallback(async () => {
    setSession('loading')
    try {
      const [me, tagList, noteList] = await Promise.all([api.me(), api.tags(), api.notes()])
      setUser(me)
      setTags(tagList.map(toTag))
      setNotes(noteList.map(toNote))
      setSession('ready')
    } catch (err) {
      if (err.status === 401) { clearToken(); setSession('guest') } else { setLoadError(err.message); setSession('error') }
    }
  }, [])
  useEffect(() => { if (getToken()) loadAll() }, [loadAll])

  const navigate = next => { window.history.pushState({}, '', next); setPath(next); window.scrollTo(0, 0) }
  // Оборачивает запрос: ошибку показывает тостом и возвращает null (401 обрабатывается отдельно — разлогин)
  const guard = async action => {
    try { return await action() } catch (err) { if (err.status !== 401) setToast(err.message); return null }
  }

  const createTag = (name, color) => guard(async () => {
    const tag = toTag(await api.createTag({ name, color }))
    setTags(current => [...current, tag])
    return tag.id
  })
  const updateTag = (id, patch) => guard(async () => {
    const tag = toTag(await api.updateTag(id, patch))
    setTags(current => current.map(item => item.id === id ? tag : item))
  })
  const deleteTag = id => guard(async () => {
    await api.deleteTag(id)
    setTags(current => current.filter(tag => tag.id !== id))
    setNotes(current => current.map(note => note.tagId === id ? { ...note, tagId: null } : note))
  })
  const saveNote = ({ id, title, body, tagId }) => guard(async () => {
    // tag_id: 0 на бэкенде означает «снять тег»
    const raw = id
      ? await api.updateNote(id, { title, text: body, tag_id: tagId ?? 0 })
      : await api.createNote({ title, text: body, tag_id: tagId })
    const note = toNote(raw)
    setNotes(current => current.some(item => item.id === note.id) ? current.map(item => item.id === note.id ? note : item) : [note, ...current])
    return true
  })
  const deleteNote = id => guard(async () => {
    await api.deleteNote(id)
    setNotes(current => current.filter(note => note.id !== id))
    return true
  })
  const logout = () => { clearToken(); resetData(); setSession('guest'); navigate('/login') }

  let page
  if (session === 'guest') {
    page = <Auth onAuthed={() => { if (path === '/login' || path === '/register') navigate('/'); loadAll() }} />
  } else if (session === 'loading') {
    page = <main className="grid min-h-screen place-items-center text-[#777]">Загрузка…</main>
  } else if (session === 'error') {
    page = <main className="grid min-h-screen place-items-center p-5 text-center"><div><p className="text-xl font-semibold">Не удалось загрузить данные</p><p className="mt-2 text-[#777]">{loadError}</p><button type="button" onClick={loadAll} className="mt-5 rounded-lg bg-[#1c1c1c] px-5 py-2 text-sm text-white">Повторить</button></div></main>
  } else if (path === '/tags') {
    page = <TagManager tags={tags} notes={notes} navigate={navigate} createTag={createTag} updateTag={updateTag} deleteTag={deleteTag} />
  } else if (path === '/notes/new') {
    page = <NoteEditor key="new" tags={tags} navigate={navigate} saveNote={saveNote} deleteNote={deleteNote} createTag={createTag} />
  } else {
    const note = path.startsWith('/notes/') ? notes.find(item => String(item.id) === decodeURIComponent(path.slice('/notes/'.length))) : null
    page = note
      ? <NoteEditor key={note.id} note={note} tags={tags} navigate={navigate} saveNote={saveNote} deleteNote={deleteNote} createTag={createTag} />
      : <Home notes={notes} tags={tags} user={user} navigate={navigate} onLogout={logout} />
  }

  return <>
    {page}
    {toast && <div role="alert" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-[#1c1c1c] px-5 py-3 text-sm text-white shadow-lg">{toast}</div>}
  </>
}
