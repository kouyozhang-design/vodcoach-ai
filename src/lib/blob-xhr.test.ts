import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BLOB_API_URL,
  blobMpuPartHeaders,
  blobMpuUrl,
  readMpuPartEtag,
  storeIdFromClientToken,
  xhrUploadLoaded,
} from "./blob-xhr.ts";

test("Safari CORS progress still counts loaded when lengthComputable is false", () => {
  assert.equal(xhrUploadLoaded({ loaded: 0, lengthComputable: true }), 0);
  assert.equal(xhrUploadLoaded({ loaded: 1_024, lengthComputable: false }), 1_024);
  assert.equal(xhrUploadLoaded({ loaded: 8_192, lengthComputable: true }), 8_192);
  assert.equal(xhrUploadLoaded({ loaded: -1 }), 0);
  assert.equal(xhrUploadLoaded({}), 0);
});

test("client token store id and MPU URL stay on the Blob API host", () => {
  assert.equal(storeIdFromClientToken("vercel_blob_client_storeId_payload"), "storeId");
  assert.equal(blobMpuUrl("coach-clips/clip.mp4"), `${BLOB_API_URL}/mpu?pathname=coach-clips%2Fclip.mp4`);
  const headers = blobMpuPartHeaders({
    token: "vercel_blob_client_storeId_payload",
    key: "coach-clips/clip.mp4",
    uploadId: "upl_1",
    partNumber: 2,
    contentType: "video/mp4",
  });
  assert.equal(headers.authorization, "Bearer vercel_blob_client_storeId_payload");
  assert.equal(headers["x-vercel-blob-store-id"], "storeId");
  assert.equal(headers["x-mpu-action"], "upload");
  assert.equal(headers["x-mpu-part-number"], "2");
  assert.equal(headers["x-content-type"], "video/mp4");
  assert.equal(readMpuPartEtag({ etag: "abc" }), "abc");
  assert.equal(readMpuPartEtag({}), "");
});
