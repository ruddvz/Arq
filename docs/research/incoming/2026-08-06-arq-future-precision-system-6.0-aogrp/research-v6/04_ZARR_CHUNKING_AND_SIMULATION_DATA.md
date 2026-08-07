# Zarr chunking and simulation data

Zarr v3 separates the logical array model, stores, codecs, and storage transformers. ARQ should apply this separation to large simulation fields, point clouds, terrain rasters, and analysis result arrays. These datasets should be chunked, codec-declared, content-addressed, and linked to exact input revisions. They should not be placed into semantic object records or treated as professional approval.
