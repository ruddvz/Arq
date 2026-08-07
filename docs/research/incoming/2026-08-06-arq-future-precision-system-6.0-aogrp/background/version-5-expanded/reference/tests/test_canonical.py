import unittest
from arq5.canonical import canonical_bytes,digest,normalize_quantity,CanonicalError

class CanonicalTests(unittest.TestCase):
    def test_map_order_does_not_change_bytes(self):
        self.assertEqual(canonical_bytes({'b':2,'a':1}),canonical_bytes({'a':1,'b':2}))
    def test_float_rejected(self):
        with self.assertRaises(CanonicalError): canonical_bytes({'x':1.0})
    def test_quantity_normalises_trailing_zero(self):
        self.assertEqual(normalize_quantity(1200,-3,'mm'),{'coefficient':12,'scale':-1,'unit':'mm'})
    def test_domain_separation(self):
        self.assertNotEqual(digest('a',{'x':1}),digest('b',{'x':1}))
