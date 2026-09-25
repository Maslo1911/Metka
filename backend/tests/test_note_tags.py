import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.database import Base
from app.models import Role, User, Note, Tag


class NoteTagsManyToManyTest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite:///:memory:')
        Base.metadata.create_all(self.engine)
        self.session = Session(self.engine)

        role = Role(id=1, name='user')
        user = User(id=1, name='Test User', login='testuser', password='hash', role=role)
        self.session.add_all([role, user])
        self.session.commit()

        self.note = Note(title='Example', text='Text', user_id=user.id)
        self.session.add(self.note)
        self.session.commit()

    def test_note_can_have_multiple_tags(self):
        tag1 = Tag(name='work', color='blue', user_id=1)
        tag2 = Tag(name='home', color='green', user_id=1)
        self.session.add_all([tag1, tag2])
        self.session.commit()

        self.note.tags = [tag1, tag2]
        self.session.commit()
        self.session.refresh(self.note)

        self.assertEqual(len(self.note.tags), 2)
        self.assertEqual({tag.name for tag in self.note.tags}, {'work', 'home'})
        self.assertEqual(self.note.tag_ids, [tag1.id, tag2.id])

        self.assertEqual(len(tag1.notes), 1)
        self.assertEqual(tag1.notes[0].id, self.note.id)


if __name__ == '__main__':
    unittest.main()
