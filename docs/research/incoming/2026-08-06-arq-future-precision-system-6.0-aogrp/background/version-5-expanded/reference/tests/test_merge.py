import unittest
from arq5.merge import three_way_components

class MergeTests(unittest.TestCase):
    def test_non_overlapping_changes_merge(self):
        merged,conflicts=three_way_components({'a':1,'b':1},{'a':2,'b':1},{'a':1,'b':2})
        self.assertEqual(merged,{'a':2,'b':2}); self.assertEqual(conflicts,[])
    def test_concurrent_change_conflicts(self):
        merged,conflicts=three_way_components({'a':1},{'a':2},{'a':3})
        self.assertEqual(len(conflicts),1); self.assertEqual(conflicts[0]['kind'],'modify-modify')
    def test_delete_modify_conflicts(self):
        _,conflicts=three_way_components({'a':1},{},{'a':2})
        self.assertEqual(conflicts[0]['kind'],'delete-modify')
