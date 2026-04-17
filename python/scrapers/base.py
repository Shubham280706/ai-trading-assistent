import logging
import time
from typing import Any

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

logger = logging.getLogger(__name__)


def make_client(headers: dict[str, str] | None = None, timeout: float = 20.0) -> httpx.Client:
    return httpx.Client(
        headers=headers or {},
        timeout=timeout,
        follow_redirects=True,
        http2=False,
    )


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type((httpx.TimeoutException, httpx.NetworkError)),
    reraise=True,
)
def safe_get(client: httpx.Client, url: str, **kwargs: Any) -> httpx.Response:
    time.sleep(1.0)  # polite delay between requests
    response = client.get(url, **kwargs)
    response.raise_for_status()
    return response


RawNewsItem = dict[str, str]
